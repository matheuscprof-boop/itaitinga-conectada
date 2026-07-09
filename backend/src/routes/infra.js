// Eixo D — Infraestrutura e Cidadania (alertas de cidadãos).
// Base: /api/infra
//
// - GET /alertas e GET /alertas/:id são PÚBLICOS (qualquer pessoa pode ver).
//   Nunca retornam o cidadao_id; o nome do autor só aparece se o alerta NÃO
//   for anônimo.
// - POST /alertas exige login de cidadão (anti-spam). Se "anonimo", o alerta é
//   gravado sem vínculo com a identidade (cidadao_id = NULL).
// - PATCH /alertas/:id (status) é exclusivo da Secretaria Municipal.

import { Router } from 'express';
import db from '../db.js';
import { autenticar, exigirPerfil } from '../auth.js';
import { uploadFoto, caminhoPublico } from '../uploads.js';
import { CATEGORIAS_INFRA, CATEGORIAS_INFRA_LABEL, STATUS_INFRA, PERFIL_CIDADAO, PERFIL_MUNICIPAL } from '../constants.js';

const router = Router();

// Projeção pública: expõe o nome do autor apenas quando não é anônimo e
// NUNCA expõe o cidadao_id.
const SELECT_PUBLICO = `
  SELECT ai.id, ai.categoria, ai.descricao, ai.foto, ai.bairro, ai.latitude, ai.longitude,
         ai.anonimo, ai.status, ai.criado_em, ai.atualizado_em,
         CASE WHEN ai.anonimo = 1 THEN NULL ELSE u.nome END AS autor_nome
  FROM alertas_infra ai
  LEFT JOIN usuarios u ON u.id = ai.cidadao_id
`;

const inserir = db.prepare(`
  INSERT INTO alertas_infra (categoria, descricao, foto, bairro, latitude, longitude, anonimo, cidadao_id)
  VALUES (@categoria, @descricao, @foto, @bairro, @latitude, @longitude, @anonimo, @cidadao_id)
`);
// Bairros distintos já usados (para alimentar o filtro e as sugestões do formulário).
const listarBairros = db.prepare(
  "SELECT DISTINCT bairro FROM alertas_infra WHERE bairro IS NOT NULL AND TRIM(bairro) <> '' ORDER BY bairro COLLATE NOCASE"
);
const obterPublico = db.prepare(`${SELECT_PUBLICO} WHERE ai.id = ?`);
const existe = db.prepare('SELECT id, status FROM alertas_infra WHERE id = ?');
const atualizarStatus = db.prepare(
  "UPDATE alertas_infra SET status = @status, atualizado_em = datetime('now') WHERE id = @id"
);

function numeroOuNulo(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function verdadeiro(v) {
  return v === true || v === 'true' || v === '1' || v === 1 || v === 'on';
}

// GET /api/infra/alertas?categoria=&status=  → lista pública
router.get('/alertas', (req, res) => {
  const cond = [];
  const params = {};
  if (req.query.categoria && CATEGORIAS_INFRA.includes(req.query.categoria)) {
    cond.push('ai.categoria = @categoria');
    params.categoria = req.query.categoria;
  }
  if (req.query.status && STATUS_INFRA.includes(req.query.status)) {
    cond.push('ai.status = @status');
    params.status = req.query.status;
  }
  // Filtro por bairro (comparação sem diferenciar maiúsculas/acentuação básica).
  if (req.query.bairro && req.query.bairro.trim()) {
    cond.push('ai.bairro = @bairro COLLATE NOCASE');
    params.bairro = req.query.bairro.trim();
  }
  const where = cond.length ? ` WHERE ${cond.join(' AND ')}` : '';
  res.json(db.prepare(`${SELECT_PUBLICO}${where} ORDER BY ai.criado_em DESC`).all(params));
});

// GET /api/infra/bairros  → lista de bairros distintos (para o filtro/sugestões).
// Definida ANTES de '/alertas/:id' não é necessário (caminho distinto), mas
// mantida aqui junto das leituras públicas.
router.get('/bairros', (_req, res) => {
  res.json(listarBairros.all().map((l) => l.bairro));
});

// GET /api/infra/alertas/:id  → detalhe público
router.get('/alertas/:id', (req, res) => {
  const alerta = obterPublico.get(req.params.id);
  if (!alerta) return res.status(404).json({ erro: 'Alerta não encontrado.' });
  res.json(alerta);
});

// POST /api/infra/alertas  → cidadão registra (multipart, foto opcional)
router.post('/alertas', autenticar, exigirPerfil(PERFIL_CIDADAO), uploadFoto, (req, res) => {
  const categoria = req.body.categoria;
  const anonimo = verdadeiro(req.body.anonimo);

  if (!CATEGORIAS_INFRA.includes(categoria)) {
    return res.status(400).json({ erro: `Categoria inválida. Use: ${CATEGORIAS_INFRA.join(', ')}.` });
  }
  // Descrição é opcional (viabiliza a denúncia rápida com 1 clique); quando
  // vazia, usa o rótulo da categoria como texto padrão.
  const descricao = (req.body.descricao ?? '').trim() || CATEGORIAS_INFRA_LABEL[categoria];

  const { lastInsertRowid } = inserir.run({
    categoria,
    descricao,
    foto: caminhoPublico(req.file),
    bairro: (req.body.bairro ?? '').trim() || null,
    latitude: numeroOuNulo(req.body.latitude),
    longitude: numeroOuNulo(req.body.longitude),
    anonimo: anonimo ? 1 : 0,
    // Anônimo: não vincula a identidade do cidadão.
    cidadao_id: anonimo ? null : req.usuario.id,
  });
  res.status(201).json(obterPublico.get(lastInsertRowid));
});

// PATCH /api/infra/alertas/:id  → Secretaria atualiza o status
router.patch('/alertas/:id', autenticar, exigirPerfil(PERFIL_MUNICIPAL), (req, res) => {
  const alerta = existe.get(req.params.id);
  if (!alerta) return res.status(404).json({ erro: 'Alerta não encontrado.' });
  if (!STATUS_INFRA.includes(req.body.status)) {
    return res.status(400).json({ erro: `Status inválido. Use: ${STATUS_INFRA.join(', ')}.` });
  }
  atualizarStatus.run({ id: alerta.id, status: req.body.status });
  res.json(obterPublico.get(alerta.id));
});

export default router;
