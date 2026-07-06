// Rotas de autenticação e gestão de usuários (com escopo por escola).
// Base: /api/auth

import crypto from 'node:crypto';
import { Router } from 'express';
import db from '../db.js';
import { gerarHashSenha, verificarSenha } from '../senha.js';
import { gerarToken, autenticar, exigirPerfil } from '../auth.js';
import { PERFIS, PERFIS_ADMIN_USUARIOS, PERFIL_CIDADAO, PERFIL_MUNICIPAL } from '../constants.js';
import { ehMunicipal } from '../escopo.js';
import { enviarCodigoVerificacao } from '../email.js';

// Perfis que podem se autocadastrar publicamente. Todos podem — mas os perfis
// privilegiados (tudo que não é cidadão) nascem PENDENTES de aprovação e o
// e-mail precisa ser verificado antes do primeiro acesso.
const PERFIS_AUTOCADASTRO = ['cidadao', 'professor', 'coordenacao', 'direcao', 'secretaria_escolar', 'secretaria'];

// Validade do código de verificação de e-mail (30 min).
const VALIDADE_CODIGO_MS = 30 * 60 * 1000;
const gerarCodigo = () => String(crypto.randomInt(100000, 1000000));

const router = Router();
const adminUsuarios = exigirPerfil(...PERFIS_ADMIN_USUARIOS);

const porEmail = db.prepare('SELECT * FROM usuarios WHERE email = ?');
const porId = db.prepare(
  `SELECT id, nome, email, perfil, escola_id, status, email_verificado, cargo, matricula_funcional, criado_em
   FROM usuarios WHERE id = ?`
);
const porIdCompleto = db.prepare('SELECT * FROM usuarios WHERE id = ?');
const COLS_LISTA = `u.id, u.nome, u.email, u.perfil, u.escola_id, e.nome AS escola_nome,
  u.status, u.email_verificado, u.cargo, u.matricula_funcional, u.criado_em`;
const listarTodos = db.prepare(`
  SELECT ${COLS_LISTA}
  FROM usuarios u LEFT JOIN escolas e ON e.id = u.escola_id
  ORDER BY u.nome COLLATE NOCASE
`);
const listarPorEscola = db.prepare(`
  SELECT ${COLS_LISTA}
  FROM usuarios u LEFT JOIN escolas e ON e.id = u.escola_id
  WHERE u.escola_id = ?
  ORDER BY u.nome COLLATE NOCASE
`);
// Contas pendentes de aprovação (por escopo). Só entram na fila as que já
// confirmaram o e-mail — aprovar não deve preceder a verificação.
const listarPendentesTodos = db.prepare(`
  SELECT ${COLS_LISTA}
  FROM usuarios u LEFT JOIN escolas e ON e.id = u.escola_id
  WHERE u.status = 'pendente' AND u.email_verificado = 1
  ORDER BY u.criado_em DESC
`);
const listarPendentesEscola = db.prepare(`
  SELECT ${COLS_LISTA}
  FROM usuarios u LEFT JOIN escolas e ON e.id = u.escola_id
  WHERE u.status = 'pendente' AND u.email_verificado = 1 AND u.escola_id = ?
  ORDER BY u.criado_em DESC
`);
const inserir = db.prepare(
  `INSERT INTO usuarios
     (nome, email, senha_hash, senha_salt, perfil, escola_id, status,
      email_verificado, codigo_verificacao, codigo_expira_em, cargo, matricula_funcional)
   VALUES
     (@nome, @email, @senha_hash, @senha_salt, @perfil, @escola_id, @status,
      @email_verificado, @codigo_verificacao, @codigo_expira_em, @cargo, @matricula_funcional)`
);
const marcarVerificado = db.prepare(
  'UPDATE usuarios SET email_verificado = 1, codigo_verificacao = NULL, codigo_expira_em = NULL WHERE id = ?'
);
const definirCodigo = db.prepare(
  'UPDATE usuarios SET codigo_verificacao = @codigo, codigo_expira_em = @expira WHERE id = @id'
);
const aprovarConta = db.prepare("UPDATE usuarios SET status = 'ativo' WHERE id = ?");
const atualizarDados = db.prepare(
  `UPDATE usuarios SET nome = @nome, email = @email, perfil = @perfil, escola_id = @escola_id,
     cargo = @cargo, matricula_funcional = @matricula_funcional WHERE id = @id`
);
const atualizarSenha = db.prepare(
  'UPDATE usuarios SET senha_hash = @senha_hash, senha_salt = @senha_salt WHERE id = @id'
);
const remover = db.prepare('DELETE FROM usuarios WHERE id = ?');
const contarPorPerfil = db.prepare('SELECT COUNT(*) AS total FROM usuarios WHERE perfil = ?');
const escolaExiste = db.prepare('SELECT 1 FROM escolas WHERE id = ?');
const listarTurmasProf = db.prepare(
  'SELECT turma FROM professor_turmas WHERE professor_id = ? ORDER BY turma COLLATE NOCASE'
);
const inserirTurmaProf = db.prepare(
  'INSERT OR IGNORE INTO professor_turmas (professor_id, turma) VALUES (?, ?)'
);
const limparTurmasProf = db.prepare('DELETE FROM professor_turmas WHERE professor_id = ?');
// Obs.: a coluna `usuarios.status` é mantida (default 'ativo') como reserva;
// atualmente todas as contas nascem ativas — sem gate de aprovação.

function usuarioPublico(u) {
  return { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, escola_id: u.escola_id, status: u.status };
}

// Resolve a escola de um usuário a criar/editar conforme quem faz a operação.
// Retorna { escola_id } ou { erro, status }.
function resolverEscola(criador, perfilAlvo, body, escolaAtual = null) {
  if (perfilAlvo === 'secretaria') {
    if (!ehMunicipal(criador)) return { erro: 'Apenas a secretaria pode criar contas municipais.', status: 403 };
    return { escola_id: null };
  }
  if (ehMunicipal(criador)) {
    const id = body.escola_id != null && body.escola_id !== '' ? Number(body.escola_id) : escolaAtual;
    if (!id || !escolaExiste.get(id)) return { erro: 'Informe uma escola válida.', status: 400 };
    return { escola_id: id };
  }
  // Direção: sempre a própria escola.
  return { escola_id: criador.escola_id };
}

// POST /api/auth/login  → { token, usuario }
router.post('/login', (req, res) => {
  const email = (req.body.email ?? '').trim().toLowerCase();
  const senha = req.body.senha ?? '';
  const usuario = porEmail.get(email);

  if (!usuario || !verificarSenha(senha, usuario.senha_hash, usuario.senha_salt)) {
    return res.status(401).json({ erro: 'E-mail ou senha inválidos.' });
  }

  // Barreira 1: e-mail precisa estar verificado. (403, não 401, para não
  // disparar o "sessão expirada" da UI.)
  if (!usuario.email_verificado) {
    return res.status(403).json({
      erro: 'Confirme seu e-mail antes de entrar. Enviamos um código no cadastro.',
      motivo: 'email_nao_verificado',
      email: usuario.email,
    });
  }
  // Barreira 2: perfis privilegiados aguardam aprovação de um responsável.
  if (usuario.status === 'pendente') {
    return res.status(403).json({
      erro: 'Sua conta está aguardando aprovação de um responsável. Você será avisado por e-mail.',
      motivo: 'pendente',
    });
  }

  const token = gerarToken({
    id: usuario.id,
    nome: usuario.nome,
    perfil: usuario.perfil,
    escola_id: usuario.escola_id ?? null,
  });
  res.json({ token, usuario: usuarioPublico(usuario) });
});

// POST /api/auth/registro  → autocadastro público
// Todo mundo verifica o e-mail (código). Cidadão nasce ATIVO (só precisa
// verificar); os perfis privilegiados (equipe/gestão/secretaria) nascem
// PENDENTES e só entram após um responsável aprovar.
router.post('/registro', async (req, res) => {
  const nome = (req.body.nome ?? '').trim();
  const email = (req.body.email ?? '').trim().toLowerCase();
  const senha = req.body.senha ?? '';
  const perfil = req.body.perfil ?? 'cidadao';
  const cargo = (req.body.cargo ?? '').trim() || null;
  const matricula_funcional = (req.body.matricula_funcional ?? '').trim() || null;

  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: 'Nome, e-mail e senha são obrigatórios.' });
  }
  if (!PERFIS_AUTOCADASTRO.includes(perfil)) {
    return res.status(400).json({ erro: 'Perfil inválido para autocadastro.' });
  }
  if (senha.length < 6) {
    return res.status(400).json({ erro: 'A senha deve ter ao menos 6 caracteres.' });
  }

  const ehCidadao = perfil === PERFIL_CIDADAO;
  const ehMunicipalPerfil = perfil === PERFIL_MUNICIPAL;
  let escola_id = null;
  // Perfis de escola (professor/coordenação/direção/secretaria escolar) precisam
  // de uma escola; cidadão e secretaria municipal não têm escola.
  if (!ehCidadao && !ehMunicipalPerfil) {
    escola_id = req.body.escola_id != null && req.body.escola_id !== '' ? Number(req.body.escola_id) : null;
    if (!escola_id || !escolaExiste.get(escola_id)) {
      return res.status(400).json({ erro: 'Selecione uma escola válida.' });
    }
  }

  const privilegiado = !ehCidadao; // toda equipe/gestão aguarda aprovação
  const codigo = gerarCodigo();
  const { senha_hash, senha_salt } = gerarHashSenha(senha);

  let novoId;
  try {
    const { lastInsertRowid } = inserir.run({
      nome, email, senha_hash, senha_salt, perfil, escola_id,
      status: privilegiado ? 'pendente' : 'ativo',
      email_verificado: 0,
      codigo_verificacao: codigo,
      codigo_expira_em: Date.now() + VALIDADE_CODIGO_MS,
      cargo, matricula_funcional,
    });
    novoId = lastInsertRowid;
  } catch (e) {
    if (String(e).includes('UNIQUE')) {
      return res.status(409).json({ erro: 'Já existe um usuário com esse e-mail.' });
    }
    console.error('[SAAE] erro ao registrar:', e);
    return res.status(500).json({ erro: 'Não foi possível criar a conta.' });
  }

  // Envia o código. Sem SMTP configurado, registra no log (permite testar
  // o fluxo offline). Nunca devolvemos o código na resposta.
  try {
    const info = await enviarCodigoVerificacao(email, codigo);
    if (!info) console.log(`[SAAE] (sem SMTP) código de verificação de ${email}: ${codigo}`);
  } catch (e) {
    console.log(`[SAAE] falha ao enviar código para ${email} (${e.message}). Código: ${codigo}`);
  }

  res.status(201).json({
    email,
    precisa_verificar: true,
    pendente_aprovacao: privilegiado,
    mensagem: `Enviamos um código de verificação para ${email}.`,
  });
});

// POST /api/auth/verificar-email  → confirma o e-mail com o código
router.post('/verificar-email', (req, res) => {
  const email = (req.body.email ?? '').trim().toLowerCase();
  const codigo = String(req.body.codigo ?? '').trim();
  const u = porEmail.get(email);
  if (!u) return res.status(404).json({ erro: 'Conta não encontrada.' });
  if (u.email_verificado) {
    return res.json({ verificado: true, pendente_aprovacao: u.status === 'pendente' });
  }
  if (!u.codigo_verificacao || u.codigo_verificacao !== codigo) {
    return res.status(400).json({ erro: 'Código incorreto. Confira e tente novamente.' });
  }
  if (!u.codigo_expira_em || Date.now() > u.codigo_expira_em) {
    return res.status(400).json({ erro: 'Código expirado. Solicite um novo.', motivo: 'expirado' });
  }
  marcarVerificado.run(u.id);
  const pendente = u.status === 'pendente';
  res.json({
    verificado: true,
    pendente_aprovacao: pendente,
    mensagem: pendente
      ? 'E-mail confirmado! Sua conta está aguardando a aprovação de um responsável.'
      : 'E-mail confirmado! Você já pode entrar.',
  });
});

// POST /api/auth/reenviar-codigo  → gera e reenvia o código
router.post('/reenviar-codigo', async (req, res) => {
  const email = (req.body.email ?? '').trim().toLowerCase();
  const u = porEmail.get(email);
  if (u && !u.email_verificado) {
    const codigo = gerarCodigo();
    definirCodigo.run({ id: u.id, codigo, expira: Date.now() + VALIDADE_CODIGO_MS });
    try {
      const info = await enviarCodigoVerificacao(email, codigo);
      if (!info) console.log(`[SAAE] (sem SMTP) novo código de ${email}: ${codigo}`);
    } catch (e) {
      console.log(`[SAAE] falha ao reenviar para ${email} (${e.message}). Código: ${codigo}`);
    }
  }
  // Resposta genérica (não revela se a conta existe).
  res.json({ mensagem: 'Se a conta existir e ainda não estiver verificada, enviamos um novo código.' });
});

// GET /api/auth/me  → dados do usuário autenticado
router.get('/me', autenticar, (req, res) => {
  const usuario = porId.get(req.usuario.id);
  if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
  res.json(usuario);
});

// PATCH /api/auth/senha  → o próprio usuário troca a senha
router.patch('/senha', autenticar, (req, res) => {
  const senhaAtual = req.body.senha_atual ?? '';
  const novaSenha = req.body.nova_senha ?? '';
  const usuario = porIdCompleto.get(req.usuario.id);
  if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
  if (!verificarSenha(senhaAtual, usuario.senha_hash, usuario.senha_salt)) {
    return res.status(400).json({ erro: 'A senha atual está incorreta.' });
  }
  if (novaSenha.length < 6) {
    return res.status(400).json({ erro: 'A nova senha deve ter ao menos 6 caracteres.' });
  }
  const { senha_hash, senha_salt } = gerarHashSenha(novaSenha);
  atualizarSenha.run({ id: usuario.id, senha_hash, senha_salt });
  res.json({ ok: true });
});

// GET /api/auth/usuarios  → lista (secretaria: todos; direção: só da sua escola)
router.get('/usuarios', autenticar, adminUsuarios, (req, res) => {
  res.json(ehMunicipal(req.usuario) ? listarTodos.all() : listarPorEscola.all(req.usuario.escola_id));
});

// GET /api/auth/usuarios/pendentes  → contas aguardando aprovação (por escopo)
router.get('/usuarios/pendentes', autenticar, adminUsuarios, (req, res) => {
  res.json(
    ehMunicipal(req.usuario)
      ? listarPendentesTodos.all()
      : listarPendentesEscola.all(req.usuario.escola_id)
  );
});

// PATCH /api/auth/usuarios/:id/aprovar  → aprova uma conta pendente
router.patch('/usuarios/:id/aprovar', autenticar, adminUsuarios, (req, res) => {
  const alvo = alvoAdministravel(req, res);
  if (!alvo) return;
  if (alvo.status !== 'pendente') {
    return res.status(400).json({ erro: 'Esta conta não está pendente de aprovação.' });
  }
  aprovarConta.run(alvo.id);
  res.json(porId.get(alvo.id));
});

// POST /api/auth/usuarios  → cria usuário
router.post('/usuarios', autenticar, adminUsuarios, (req, res) => {
  const nome = (req.body.nome ?? '').trim();
  const email = (req.body.email ?? '').trim().toLowerCase();
  const senha = req.body.senha ?? '';
  const perfil = req.body.perfil ?? 'professor';

  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: 'Nome, e-mail e senha são obrigatórios.' });
  }
  if (!PERFIS.includes(perfil)) {
    return res.status(400).json({ erro: `Perfil inválido. Use: ${PERFIS.join(', ')}.` });
  }
  if (senha.length < 6) {
    return res.status(400).json({ erro: 'A senha deve ter ao menos 6 caracteres.' });
  }

  const escopo = resolverEscola(req.usuario, perfil, req.body);
  if (escopo.erro) return res.status(escopo.status).json({ erro: escopo.erro });

  // Contas criadas por um admin já nascem ativas e verificadas (o admin
  // responde pelo vínculo). Não passam pelo fluxo de código.
  const { senha_hash, senha_salt } = gerarHashSenha(senha);
  try {
    const { lastInsertRowid } = inserir.run({
      nome, email, senha_hash, senha_salt, perfil, escola_id: escopo.escola_id, status: 'ativo',
      email_verificado: 1, codigo_verificacao: null, codigo_expira_em: null,
      cargo: (req.body.cargo ?? '').trim() || null,
      matricula_funcional: (req.body.matricula_funcional ?? '').trim() || null,
    });
    res.status(201).json(porId.get(lastInsertRowid));
  } catch (e) {
    if (String(e).includes('UNIQUE')) {
      return res.status(409).json({ erro: 'Já existe um usuário com esse e-mail.' });
    }
    throw e;
  }
});

// PUT /api/auth/usuarios/:id  → edita nome/e-mail/perfil/escola e, opcionalmente, a senha
router.put('/usuarios/:id', autenticar, adminUsuarios, (req, res) => {
  const id = Number(req.params.id);
  const alvo = porIdCompleto.get(id);
  if (!alvo) return res.status(404).json({ erro: 'Usuário não encontrado.' });

  // Direção só administra usuários da própria escola.
  if (!ehMunicipal(req.usuario) && alvo.escola_id !== req.usuario.escola_id) {
    return res.status(403).json({ erro: 'Você não pode editar usuários de outra escola.' });
  }

  const nome = (req.body.nome ?? '').trim();
  const email = (req.body.email ?? '').trim().toLowerCase();
  const perfil = req.body.perfil ?? alvo.perfil;
  const novaSenha = req.body.nova_senha ?? '';

  if (!nome || !email) return res.status(400).json({ erro: 'Nome e e-mail são obrigatórios.' });
  if (!PERFIS.includes(perfil)) {
    return res.status(400).json({ erro: `Perfil inválido. Use: ${PERFIS.join(', ')}.` });
  }
  if (id === req.usuario.id && perfil !== alvo.perfil) {
    return res.status(400).json({ erro: 'Você não pode alterar o próprio perfil.' });
  }
  if (alvo.perfil === 'secretaria' && perfil !== 'secretaria' && contarPorPerfil.get('secretaria').total <= 1) {
    return res.status(400).json({ erro: 'Deve existir ao menos uma conta de Secretaria.' });
  }

  const escopo = resolverEscola(req.usuario, perfil, req.body, alvo.escola_id);
  if (escopo.erro) return res.status(escopo.status).json({ erro: escopo.erro });

  try {
    atualizarDados.run({
      id, nome, email, perfil, escola_id: escopo.escola_id,
      cargo: (req.body.cargo ?? alvo.cargo ?? '').trim() || null,
      matricula_funcional: (req.body.matricula_funcional ?? alvo.matricula_funcional ?? '').trim() || null,
    });
    if (novaSenha) {
      if (novaSenha.length < 6) {
        return res.status(400).json({ erro: 'A nova senha deve ter ao menos 6 caracteres.' });
      }
      const { senha_hash, senha_salt } = gerarHashSenha(novaSenha);
      atualizarSenha.run({ id, senha_hash, senha_salt });
    }
    res.json(porId.get(id));
  } catch (e) {
    if (String(e).includes('UNIQUE')) {
      return res.status(409).json({ erro: 'Já existe um usuário com esse e-mail.' });
    }
    throw e;
  }
});

// DELETE /api/auth/usuarios/:id  → remove
router.delete('/usuarios/:id', autenticar, adminUsuarios, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.usuario.id) {
    return res.status(400).json({ erro: 'Você não pode remover o próprio usuário.' });
  }
  const alvo = porIdCompleto.get(id);
  if (!alvo) return res.status(404).json({ erro: 'Usuário não encontrado.' });
  if (!ehMunicipal(req.usuario) && alvo.escola_id !== req.usuario.escola_id) {
    return res.status(403).json({ erro: 'Você não pode remover usuários de outra escola.' });
  }
  if (alvo.perfil === 'secretaria' && contarPorPerfil.get('secretaria').total <= 1) {
    return res.status(400).json({ erro: 'Deve existir ao menos uma conta de Secretaria.' });
  }
  remover.run(id);
  res.status(204).end();
});

// Carrega o usuário-alvo garantindo o escopo do admin (direção: só a sua escola).
// Responde o erro e retorna null quando não permitido.
function alvoAdministravel(req, res) {
  const alvo = porIdCompleto.get(Number(req.params.id));
  if (!alvo) {
    res.status(404).json({ erro: 'Usuário não encontrado.' });
    return null;
  }
  if (!ehMunicipal(req.usuario) && alvo.escola_id !== req.usuario.escola_id) {
    res.status(403).json({ erro: 'Você não pode gerenciar usuários de outra escola.' });
    return null;
  }
  return alvo;
}

// GET /api/auth/usuarios/:id/turmas → turmas de responsabilidade do professor
router.get('/usuarios/:id/turmas', autenticar, adminUsuarios, (req, res) => {
  const alvo = alvoAdministravel(req, res);
  if (!alvo) return;
  res.json({ turmas: listarTurmasProf.all(alvo.id).map((r) => r.turma) });
});

// PUT /api/auth/usuarios/:id/turmas → substitui a lista de turmas do professor
router.put('/usuarios/:id/turmas', autenticar, adminUsuarios, (req, res) => {
  const alvo = alvoAdministravel(req, res);
  if (!alvo) return;
  if (alvo.perfil !== 'professor') {
    return res.status(400).json({ erro: 'Apenas professores têm turmas de responsabilidade.' });
  }
  const entrada = Array.isArray(req.body.turmas) ? req.body.turmas : [];
  const turmas = [...new Set(entrada.map((t) => String(t).trim()).filter(Boolean))];

  const aplicar = db.transaction(() => {
    limparTurmasProf.run(alvo.id);
    for (const t of turmas) inserirTurmaProf.run(alvo.id, t);
  });
  aplicar();

  res.json({ turmas: listarTurmasProf.all(alvo.id).map((r) => r.turma) });
});

export default router;
