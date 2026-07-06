// Rotas de autenticação e gestão de usuários (com escopo por escola).
// Base: /api/auth

import { Router } from 'express';
import db from '../db.js';
import { gerarHashSenha, verificarSenha } from '../senha.js';
import { gerarToken, autenticar, exigirPerfil } from '../auth.js';
import { PERFIS, PERFIS_ADMIN_USUARIOS, PERFIL_CIDADAO, PERFIL_MUNICIPAL } from '../constants.js';
import { ehMunicipal } from '../escopo.js';

// Perfis que podem se autocadastrar publicamente. Secretaria (municipal, acesso
// total) NÃO entra aqui — só um admin existente cria contas de secretaria.
const PERFIS_AUTOCADASTRO = ['cidadao', 'professor', 'coordenacao', 'direcao'];

const router = Router();
const adminUsuarios = exigirPerfil(...PERFIS_ADMIN_USUARIOS);

const porEmail = db.prepare('SELECT * FROM usuarios WHERE email = ?');
const porId = db.prepare(
  'SELECT id, nome, email, perfil, escola_id, status, criado_em FROM usuarios WHERE id = ?'
);
const porIdCompleto = db.prepare('SELECT * FROM usuarios WHERE id = ?');
const listarTodos = db.prepare(`
  SELECT u.id, u.nome, u.email, u.perfil, u.escola_id, e.nome AS escola_nome, u.status, u.criado_em
  FROM usuarios u LEFT JOIN escolas e ON e.id = u.escola_id
  ORDER BY u.nome COLLATE NOCASE
`);
const listarPorEscola = db.prepare(`
  SELECT u.id, u.nome, u.email, u.perfil, u.escola_id, e.nome AS escola_nome, u.status, u.criado_em
  FROM usuarios u LEFT JOIN escolas e ON e.id = u.escola_id
  WHERE u.escola_id = ?
  ORDER BY u.nome COLLATE NOCASE
`);
const inserir = db.prepare(
  `INSERT INTO usuarios (nome, email, senha_hash, senha_salt, perfil, escola_id, status)
   VALUES (@nome, @email, @senha_hash, @senha_salt, @perfil, @escola_id, @status)`
);
const atualizarDados = db.prepare(
  'UPDATE usuarios SET nome = @nome, email = @email, perfil = @perfil, escola_id = @escola_id WHERE id = @id'
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

  const token = gerarToken({
    id: usuario.id,
    nome: usuario.nome,
    perfil: usuario.perfil,
    escola_id: usuario.escola_id ?? null,
  });
  res.json({ token, usuario: usuarioPublico(usuario) });
});

// POST /api/auth/registro  → autocadastro público
// Cidadão nasce ATIVO; equipe (professor/coordenação/direção) nasce PENDENTE e
// precisa de aprovação. Secretaria não pode ser criada por aqui.
router.post('/registro', (req, res) => {
  const nome = (req.body.nome ?? '').trim();
  const email = (req.body.email ?? '').trim().toLowerCase();
  const senha = req.body.senha ?? '';
  const perfil = req.body.perfil ?? 'cidadao';

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
  let escola_id = null;
  if (!ehCidadao) {
    // Equipe precisa vincular uma escola válida.
    escola_id = req.body.escola_id != null && req.body.escola_id !== '' ? Number(req.body.escola_id) : null;
    if (!escola_id || !escolaExiste.get(escola_id)) {
      return res.status(400).json({ erro: 'Selecione uma escola válida.' });
    }
  }

  const { senha_hash, senha_salt } = gerarHashSenha(senha);
  try {
    const { lastInsertRowid } = inserir.run({
      nome, email, senha_hash, senha_salt, perfil, escola_id, status: 'ativo',
    });
    res.status(201).json({
      usuario: porId.get(lastInsertRowid),
      pendente: false,
      mensagem: 'Conta criada com sucesso. Você já pode entrar.',
    });
  } catch (e) {
    if (String(e).includes('UNIQUE')) {
      return res.status(409).json({ erro: 'Já existe um usuário com esse e-mail.' });
    }
    throw e;
  }
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

  const { senha_hash, senha_salt } = gerarHashSenha(senha);
  try {
    const { lastInsertRowid } = inserir.run({
      nome, email, senha_hash, senha_salt, perfil, escola_id: escopo.escola_id, status: 'ativo',
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
    atualizarDados.run({ id, nome, email, perfil, escola_id: escopo.escola_id });
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
