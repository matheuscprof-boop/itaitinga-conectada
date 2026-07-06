// Eixo A — Saúde Escolar (dados por aluno).
// Base: /api/saude
// Vacinação, alergias e registro diário de sintomas. O registro de sintomas
// dispara um alerta automático quando muitos alunos da mesma turma relatam
// sintomas semelhantes num curto período.

import { Router } from 'express';
import db from '../db.js';
import { VACINACAO_STATUS, LIMITE_SINTOMAS } from '../constants.js';
import { alunoNoEscopo } from '../alunoEscopo.js';
import { notificar } from '../notificador.js';

const router = Router();

const obterSaude = db.prepare('SELECT * FROM saude_aluno WHERE aluno_id = ?');
const upsertSaude = db.prepare(`
  INSERT INTO saude_aluno (aluno_id, vacinacao_status, vacinas, alergias, atualizado_em)
  VALUES (@aluno_id, @vacinacao_status, @vacinas, @alergias, datetime('now'))
  ON CONFLICT(aluno_id) DO UPDATE SET
    vacinacao_status = excluded.vacinacao_status,
    vacinas = excluded.vacinas,
    alergias = excluded.alergias,
    atualizado_em = datetime('now')
`);

const listarSintomas = db.prepare(
  'SELECT * FROM saude_sintomas WHERE aluno_id = ? ORDER BY criado_em DESC, id DESC LIMIT 50'
);
const inserirSintoma = db.prepare(`
  INSERT INTO saude_sintomas (aluno_id, data, sintomas, observacao, autor_id, autor_nome)
  VALUES (@aluno_id, @data, @sintomas, @observacao, @autor_id, @autor_nome)
`);
const sintomasRecentesDaTurma = db.prepare(`
  SELECT s.aluno_id, s.sintomas
  FROM saude_sintomas s
  JOIN alunos a ON a.id = s.aluno_id
  WHERE a.turma = @turma AND a.escola_id = @escola
    AND s.criado_em >= datetime('now', '-1 day')
`);

// Normaliza uma lista de sintomas ("Febre, Tosse") em tokens comparáveis.
function tokens(csv) {
  return (csv || '')
    .split(/[,;]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

// Após registrar um sintoma, verifica se o limite por turma foi atingido.
function verificarSurto(aluno, novosSintomas) {
  const alvo = new Set(tokens(novosSintomas));
  if (alvo.size === 0) return null;

  const linhas = sintomasRecentesDaTurma.all({ turma: aluno.turma, escola: aluno.escola_id });
  const alunosAfetados = new Set();
  for (const l of linhas) {
    if (tokens(l.sintomas).some((t) => alvo.has(t))) alunosAfetados.add(l.aluno_id);
  }

  if (alunosAfetados.size >= LIMITE_SINTOMAS) {
    const sintomasTxt = [...alvo].join(', ');
    const titulo = `Possível surto na turma ${aluno.turma}`;
    const mensagem =
      `${alunosAfetados.size} aluno(s) da turma ${aluno.turma} relataram sintomas semelhantes ` +
      `(${sintomasTxt}) nas últimas 24h. Verifique a situação.`;
    notificar({ titulo, mensagem, escolaId: aluno.escola_id, turma: aluno.turma });
    return { alunos_afetados: alunosAfetados.size, sintomas: sintomasTxt };
  }
  return null;
}

// GET /api/saude/:alunoId → dados de saúde + sintomas recentes
router.get('/:alunoId', (req, res) => {
  const aluno = alunoNoEscopo(req, req.params.alunoId);
  if (!aluno) return res.status(404).json({ erro: 'Aluno não encontrado.' });
  const saude = obterSaude.get(aluno.id) || {
    aluno_id: aluno.id,
    vacinacao_status: 'pendente',
    vacinas: null,
    alergias: null,
  };
  saude.sintomas = listarSintomas.all(aluno.id);
  res.json(saude);
});

// PUT /api/saude/:alunoId → cria/atualiza vacinação e alergias
router.put('/:alunoId', (req, res) => {
  const aluno = alunoNoEscopo(req, req.params.alunoId);
  if (!aluno) return res.status(404).json({ erro: 'Aluno não encontrado.' });

  const vacinacao_status = req.body.vacinacao_status ?? 'pendente';
  if (!VACINACAO_STATUS.includes(vacinacao_status)) {
    return res.status(400).json({ erro: `Status de vacinação inválido. Use: ${VACINACAO_STATUS.join(', ')}.` });
  }
  upsertSaude.run({
    aluno_id: aluno.id,
    vacinacao_status,
    vacinas: req.body.vacinas || null,
    alergias: req.body.alergias || null,
  });
  res.json(obterSaude.get(aluno.id));
});

// POST /api/saude/:alunoId/sintomas → registra sintomas do dia
router.post('/:alunoId/sintomas', (req, res) => {
  const aluno = alunoNoEscopo(req, req.params.alunoId);
  if (!aluno) return res.status(404).json({ erro: 'Aluno não encontrado.' });

  const sintomas = (req.body.sintomas ?? '').trim();
  if (!sintomas) return res.status(400).json({ erro: 'Informe ao menos um sintoma.' });

  const { lastInsertRowid } = inserirSintoma.run({
    aluno_id: aluno.id,
    data: req.body.data || new Date().toISOString().slice(0, 10),
    sintomas,
    observacao: req.body.observacao || null,
    autor_id: req.usuario?.id ?? null,
    autor_nome: req.usuario?.nome ?? null,
  });

  const surto = verificarSurto(aluno, sintomas);
  const criado = db.prepare('SELECT * FROM saude_sintomas WHERE id = ?').get(lastInsertRowid);
  res.status(201).json({ ...criado, surto });
});

// GET /api/saude/:alunoId/sintomas → histórico de sintomas
router.get('/:alunoId/sintomas', (req, res) => {
  const aluno = alunoNoEscopo(req, req.params.alunoId);
  if (!aluno) return res.status(404).json({ erro: 'Aluno não encontrado.' });
  res.json(listarSintomas.all(aluno.id));
});

export default router;
