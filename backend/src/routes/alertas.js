// Rotas para registro e acompanhamento de alertas, incluindo a linha do
// tempo (histórico) de cada um.
// Base: /api/alertas

import { Router } from 'express';
import db from '../db.js';
import { EIXOS, NIVEIS, STATUS, CATEGORIAS_ALERTA, PERFIS_GESTAO } from '../constants.js';
import { exigirPerfil } from '../auth.js';
import { montarFiltrosAlertas } from '../filtros.js';
import { notificarAlertaAlto } from '../notificador.js';
import { filtrosComEscola, escolaEfetiva, ehMunicipal } from '../escopo.js';

const router = Router();
const podeGerenciar = exigirPerfil(...PERFIS_GESTAO);

// Traz o nome/turma do aluno junto (JOIN) para facilitar as listas.
const listarBase = `
  SELECT al.*, a.nome AS aluno_nome, a.turma AS aluno_turma
  FROM alertas al
  JOIN alunos a ON a.id = al.aluno_id
`;

const obterPorId = db.prepare('SELECT * FROM alertas WHERE id = ?');
const alunoPorId = db.prepare('SELECT id, nome, turma, escola_id FROM alunos WHERE id = ?');
const escolaDoAlerta = db.prepare(
  'SELECT a.escola_id FROM alertas al JOIN alunos a ON a.id = al.aluno_id WHERE al.id = ?'
);

// Verifica se um alerta está no escopo de escola do usuário.
function alertaNoEscopo(req, alertaId) {
  if (ehMunicipal(req.usuario)) return true;
  const row = escolaDoAlerta.get(alertaId);
  return !!row && row.escola_id === req.usuario.escola_id;
}

const inserir = db.prepare(`
  INSERT INTO alertas (aluno_id, eixo, nivel, categoria, titulo, descricao)
  VALUES (@aluno_id, @eixo, @nivel, @categoria, @titulo, @descricao)
`);

const atualizarStatus = db.prepare(`
  UPDATE alertas
  SET status = @status, atualizado_em = datetime('now')
  WHERE id = @id
`);

const remover = db.prepare('DELETE FROM alertas WHERE id = ?');

const inserirHistorico = db.prepare(`
  INSERT INTO alerta_historico
    (alerta_id, tipo, texto, status_anterior, status_novo, autor_id, autor_nome)
  VALUES
    (@alerta_id, @tipo, @texto, @status_anterior, @status_novo, @autor_id, @autor_nome)
`);

const listarHistorico = db.prepare(
  'SELECT * FROM alerta_historico WHERE alerta_id = ? ORDER BY criado_em ASC, id ASC'
);

// Cria o alerta e já registra a entrada inicial na linha do tempo,
// tudo em uma transação para manter a consistência.
const criarComHistorico = db.transaction((dados, autor) => {
  const { lastInsertRowid } = inserir.run(dados);
  inserirHistorico.run({
    alerta_id: lastInsertRowid,
    tipo: 'mudanca_status',
    texto: 'Alerta registrado.',
    status_anterior: null,
    status_novo: 'aberto',
    autor_id: autor?.id ?? null,
    autor_nome: autor?.nome ?? null,
  });
  return lastInsertRowid;
});

// Muda o status e registra a mudança na linha do tempo.
const mudarStatusComHistorico = db.transaction((id, statusNovo, statusAtual, autor) => {
  atualizarStatus.run({ id, status: statusNovo });
  inserirHistorico.run({
    alerta_id: id,
    tipo: 'mudanca_status',
    texto: null,
    status_anterior: statusAtual,
    status_novo: statusNovo,
    autor_id: autor?.id ?? null,
    autor_nome: autor?.nome ?? null,
  });
});

// GET /api/alertas?eixo=&nivel=&status=&aluno_id=&turma=&de=&ate=&escola_id=
router.get('/', (req, res) => {
  const { where, params } = montarFiltrosAlertas(filtrosComEscola(req));
  const sql = `${listarBase}${where} ORDER BY al.criado_em DESC`;
  res.json(db.prepare(sql).all(params));
});

// GET /api/alertas/resumo  → contagem de alertas abertos por eixo (escopado)
router.get('/resumo', (req, res) => {
  const escola = escolaEfetiva(req);
  const cond = ["al.status != 'resolvido'"];
  const params = {};
  if (escola != null) {
    cond.push('a.escola_id = @escola');
    params.escola = escola;
  }
  const linhas = db
    .prepare(
      `SELECT al.eixo AS eixo, COUNT(*) AS total
       FROM alertas al JOIN alunos a ON a.id = al.aluno_id
       WHERE ${cond.join(' AND ')}
       GROUP BY al.eixo`
    )
    .all(params);
  const resumo = Object.fromEntries(EIXOS.map((e) => [e, 0]));
  for (const l of linhas) resumo[l.eixo] = l.total;
  res.json(resumo);
});

// POST /api/alertas  → registra um novo alerta (qualquer usuário autenticado)
router.post('/', (req, res) => {
  // Categoria é opcional; só aceita valores conhecidos (senão fica nula).
  const categoria = CATEGORIAS_ALERTA.includes(req.body.categoria) ? req.body.categoria : null;
  const dados = {
    aluno_id: Number(req.body.aluno_id),
    eixo: req.body.eixo,
    nivel: req.body.nivel,
    categoria,
    titulo: (req.body.titulo ?? '').trim(),
    descricao: req.body.descricao || null,
  };

  const aluno = dados.aluno_id ? alunoPorId.get(dados.aluno_id) : null;
  if (!aluno) {
    return res.status(400).json({ erro: 'Aluno inválido ou inexistente.' });
  }
  // Impede registrar alerta para aluno de outra escola.
  if (!ehMunicipal(req.usuario) && aluno.escola_id !== req.usuario.escola_id) {
    return res.status(403).json({ erro: 'Aluno fora da sua escola.' });
  }
  if (!EIXOS.includes(dados.eixo)) {
    return res.status(400).json({ erro: `Eixo inválido. Use: ${EIXOS.join(', ')}.` });
  }
  if (!NIVEIS.includes(dados.nivel)) {
    return res.status(400).json({ erro: `Nível inválido. Use: ${NIVEIS.join(', ')}.` });
  }
  if (!dados.titulo) {
    return res.status(400).json({ erro: 'O título do alerta é obrigatório.' });
  }

  const id = criarComHistorico(dados, req.usuario);
  const criado = obterPorId.get(id);

  // Alertas de nível alto geram uma notificação para a equipe de gestão.
  if (criado.nivel === 'alto') {
    notificarAlertaAlto(criado, aluno.nome, aluno.escola_id, aluno.turma);
  }

  res.status(201).json(criado);
});

// PATCH /api/alertas/:id  → atualiza apenas o status (fluxo de acompanhamento)
router.patch('/:id', (req, res) => {
  const alerta = obterPorId.get(req.params.id);
  if (!alerta || !alertaNoEscopo(req, alerta.id)) {
    return res.status(404).json({ erro: 'Alerta não encontrado.' });
  }
  if (!STATUS.includes(req.body.status)) {
    return res.status(400).json({ erro: `Status inválido. Use: ${STATUS.join(', ')}.` });
  }
  if (req.body.status !== alerta.status) {
    mudarStatusComHistorico(alerta.id, req.body.status, alerta.status, req.usuario);
  }
  res.json(obterPorId.get(alerta.id));
});

// DELETE /api/alertas/:id  → remove (coordenação/direção/secretaria)
router.delete('/:id', podeGerenciar, (req, res) => {
  const alerta = obterPorId.get(req.params.id);
  if (!alerta || !alertaNoEscopo(req, alerta.id)) {
    return res.status(404).json({ erro: 'Alerta não encontrado.' });
  }
  remover.run(alerta.id);
  res.status(204).end();
});

// GET /api/alertas/:id/historico  → linha do tempo do alerta
router.get('/:id/historico', (req, res) => {
  if (!obterPorId.get(req.params.id) || !alertaNoEscopo(req, req.params.id)) {
    return res.status(404).json({ erro: 'Alerta não encontrado.' });
  }
  res.json(listarHistorico.all(req.params.id));
});

// POST /api/alertas/:id/historico  → adiciona um comentário à linha do tempo
router.post('/:id/historico', (req, res) => {
  const alerta = obterPorId.get(req.params.id);
  if (!alerta || !alertaNoEscopo(req, alerta.id)) {
    return res.status(404).json({ erro: 'Alerta não encontrado.' });
  }

  const texto = (req.body.texto ?? '').trim();
  if (!texto) return res.status(400).json({ erro: 'O comentário não pode ficar vazio.' });

  const { lastInsertRowid } = inserirHistorico.run({
    alerta_id: alerta.id,
    tipo: 'comentario',
    texto,
    status_anterior: null,
    status_novo: null,
    autor_id: req.usuario?.id ?? null,
    autor_nome: req.usuario?.nome ?? null,
  });
  res.status(201).json(db.prepare('SELECT * FROM alerta_historico WHERE id = ?').get(lastInsertRowid));
});

export default router;
