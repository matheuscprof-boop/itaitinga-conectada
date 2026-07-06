// Rotas de CRUD para os alunos, com escopo por escola.
// Base: /api/alunos

import { Router } from 'express';
import db from '../db.js';
import { exigirPerfil } from '../auth.js';
import { PERFIS_GESTAO } from '../constants.js';
import { escolaEfetiva, ehMunicipal } from '../escopo.js';

const router = Router();

// Apenas coordenação/direção/secretaria gerenciam o cadastro de alunos.
const podeGerenciar = exigirPerfil(...PERFIS_GESTAO);

const obterPorId = db.prepare(`
  SELECT a.*, e.nome AS escola_nome
  FROM alunos a LEFT JOIN escolas e ON e.id = a.escola_id
  WHERE a.id = ?
`);
const alertasDoAluno = db.prepare(
  'SELECT * FROM alertas WHERE aluno_id = ? ORDER BY criado_em DESC'
);
const escolaExiste = db.prepare('SELECT 1 FROM escolas WHERE id = ?');

const inserir = db.prepare(`
  INSERT INTO alunos (escola_id, nome, matricula, turma, data_nascimento,
                      responsavel_nome, responsavel_contato, observacoes)
  VALUES (@escola_id, @nome, @matricula, @turma, @data_nascimento,
          @responsavel_nome, @responsavel_contato, @observacoes)
`);

// A atualização NÃO altera a escola do aluno (feita apenas no cadastro).
const atualizar = db.prepare(`
  UPDATE alunos SET
    nome = @nome,
    matricula = @matricula,
    turma = @turma,
    data_nascimento = @data_nascimento,
    responsavel_nome = @responsavel_nome,
    responsavel_contato = @responsavel_contato,
    observacoes = @observacoes,
    atualizado_em = datetime('now')
  WHERE id = @id
`);

const remover = db.prepare('DELETE FROM alunos WHERE id = ?');

function normalizarAluno(body) {
  return {
    nome: (body.nome ?? '').trim(),
    matricula: (body.matricula ?? '').trim(),
    turma: (body.turma ?? '').trim(),
    data_nascimento: body.data_nascimento || null,
    responsavel_nome: body.responsavel_nome || null,
    responsavel_contato: body.responsavel_contato || null,
    observacoes: body.observacoes || null,
  };
}

// O usuário pode acessar este aluno? (municipal vê todos; demais, só a sua escola)
function podeAcessar(req, aluno) {
  return ehMunicipal(req.usuario) || aluno.escola_id === req.usuario.escola_id;
}

// GET /api/alunos?q=texto  → lista (escopada por escola, com busca opcional)
router.get('/', (req, res) => {
  const escola = escolaEfetiva(req);
  const q = (req.query.q ?? '').trim();
  const cond = [];
  const params = {};
  if (escola != null) {
    cond.push('a.escola_id = @escola');
    params.escola = escola;
  }
  if (q) {
    cond.push('(a.nome LIKE @q OR a.matricula LIKE @q OR a.turma LIKE @q)');
    params.q = `%${q}%`;
  }
  const where = cond.length ? ` WHERE ${cond.join(' AND ')}` : '';
  const sql = `
    SELECT a.*, e.nome AS escola_nome, COUNT(al.id) AS total_alertas
    FROM alunos a
    LEFT JOIN escolas e ON e.id = a.escola_id
    LEFT JOIN alertas al ON al.aluno_id = a.id AND al.status != 'resolvido'
    ${where}
    GROUP BY a.id
    ORDER BY a.nome COLLATE NOCASE
  `;
  res.json(db.prepare(sql).all(params));
});

// GET /api/alunos/turmas  → turmas distintas do escopo (para filtros)
router.get('/turmas', (req, res) => {
  const escola = escolaEfetiva(req);
  const sql =
    escola == null
      ? 'SELECT DISTINCT turma FROM alunos ORDER BY turma COLLATE NOCASE'
      : 'SELECT DISTINCT turma FROM alunos WHERE escola_id = @escola ORDER BY turma COLLATE NOCASE';
  res.json(db.prepare(sql).all(escola == null ? {} : { escola }).map((l) => l.turma));
});

// GET /api/alunos/:id  → aluno + seus alertas
router.get('/:id', (req, res) => {
  const aluno = obterPorId.get(req.params.id);
  if (!aluno || !podeAcessar(req, aluno)) {
    return res.status(404).json({ erro: 'Aluno não encontrado.' });
  }
  aluno.alertas = alertasDoAluno.all(aluno.id);
  res.json(aluno);
});

// Resolve a escola para o novo aluno conforme o perfil.
function escolaDoNovoAluno(req) {
  if (ehMunicipal(req.usuario)) {
    const id = req.body.escola_id ? Number(req.body.escola_id) : null;
    if (!id || !escolaExiste.get(id)) return { erro: 'Informe uma escola válida.' };
    return { escola_id: id };
  }
  return { escola_id: req.usuario.escola_id };
}

// POST /api/alunos  → cria (coordenação/direção/secretaria)
router.post('/', podeGerenciar, (req, res) => {
  const dados = normalizarAluno(req.body);
  if (!dados.nome || !dados.matricula || !dados.turma) {
    return res.status(400).json({ erro: 'Os campos nome, matrícula e turma são obrigatórios.' });
  }
  const escopo = escolaDoNovoAluno(req);
  if (escopo.erro) return res.status(400).json({ erro: escopo.erro });

  try {
    const { lastInsertRowid } = inserir.run({ ...dados, escola_id: escopo.escola_id });
    res.status(201).json(obterPorId.get(lastInsertRowid));
  } catch (e) {
    if (String(e).includes('UNIQUE')) {
      return res.status(409).json({ erro: 'Já existe um aluno com essa matrícula.' });
    }
    throw e;
  }
});

// PUT /api/alunos/:id  → atualiza (coordenação/direção/secretaria)
router.put('/:id', podeGerenciar, (req, res) => {
  const atual = obterPorId.get(req.params.id);
  if (!atual || !podeAcessar(req, atual)) {
    return res.status(404).json({ erro: 'Aluno não encontrado.' });
  }
  const dados = { ...normalizarAluno(req.body), id: Number(req.params.id) };
  if (!dados.nome || !dados.matricula || !dados.turma) {
    return res.status(400).json({ erro: 'Os campos nome, matrícula e turma são obrigatórios.' });
  }
  try {
    atualizar.run(dados);
    res.json(obterPorId.get(dados.id));
  } catch (e) {
    if (String(e).includes('UNIQUE')) {
      return res.status(409).json({ erro: 'Já existe um aluno com essa matrícula.' });
    }
    throw e;
  }
});

// DELETE /api/alunos/:id  → remove (alertas caem em cascata)
router.delete('/:id', podeGerenciar, (req, res) => {
  const atual = obterPorId.get(req.params.id);
  if (!atual || !podeAcessar(req, atual)) {
    return res.status(404).json({ erro: 'Aluno não encontrado.' });
  }
  remover.run(atual.id);
  res.status(204).end();
});

export default router;
