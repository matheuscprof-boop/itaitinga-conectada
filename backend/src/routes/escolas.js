// Rotas de escolas. Leitura é permitida a qualquer usuário autenticado
// (escopada por escola); criação/edição/remoção é exclusiva da Secretaria.
// Base: /api/escolas

import { Router } from 'express';
import db from '../db.js';
import { exigirPerfil } from '../auth.js';
import { ehMunicipal } from '../escopo.js';

const router = Router();
const soSecretaria = exigirPerfil('secretaria');

const listar = db.prepare('SELECT * FROM escolas ORDER BY nome COLLATE NOCASE');
const obter = db.prepare('SELECT * FROM escolas WHERE id = ?');
const inserir = db.prepare(`
  INSERT INTO escolas (nome, municipio, endereco, latitude, longitude)
  VALUES (@nome, @municipio, @endereco, @latitude, @longitude)
`);
const atualizar = db.prepare(`
  UPDATE escolas SET nome = @nome, municipio = @municipio, endereco = @endereco,
                     latitude = @latitude, longitude = @longitude
  WHERE id = @id
`);
const remover = db.prepare('DELETE FROM escolas WHERE id = ?');

// Normaliza o corpo, convertendo coordenadas para número (ou null).
function normalizar(body) {
  const num = (v) => (v === '' || v == null ? null : Number(v));
  return {
    nome: (body.nome ?? '').trim(),
    municipio: body.municipio || null,
    endereco: body.endereco || null,
    latitude: num(body.latitude),
    longitude: num(body.longitude),
  };
}

// GET /api/escolas  → todas (secretaria) ou apenas a própria (demais perfis)
router.get('/', (req, res) => {
  if (ehMunicipal(req.usuario)) return res.json(listar.all());
  const minha = req.usuario.escola_id ? obter.get(req.usuario.escola_id) : null;
  res.json(minha ? [minha] : []);
});

// GET /api/escolas/:id
router.get('/:id', (req, res) => {
  const escola = obter.get(req.params.id);
  if (!escola) return res.status(404).json({ erro: 'Escola não encontrada.' });
  if (!ehMunicipal(req.usuario) && escola.id !== req.usuario.escola_id) {
    return res.status(403).json({ erro: 'Acesso restrito à sua escola.' });
  }
  res.json(escola);
});

// POST /api/escolas  → cria (secretaria)
router.post('/', soSecretaria, (req, res) => {
  const dados = normalizar(req.body);
  if (!dados.nome) return res.status(400).json({ erro: 'O nome da escola é obrigatório.' });
  const { lastInsertRowid } = inserir.run(dados);
  res.status(201).json(obter.get(lastInsertRowid));
});

// PUT /api/escolas/:id  → atualiza (secretaria)
router.put('/:id', soSecretaria, (req, res) => {
  if (!obter.get(req.params.id)) return res.status(404).json({ erro: 'Escola não encontrada.' });
  const dados = { ...normalizar(req.body), id: Number(req.params.id) };
  if (!dados.nome) return res.status(400).json({ erro: 'O nome da escola é obrigatório.' });
  atualizar.run(dados);
  res.json(obter.get(dados.id));
});

// DELETE /api/escolas/:id  → remove (secretaria)
router.delete('/:id', soSecretaria, (req, res) => {
  const { changes } = remover.run(req.params.id);
  if (!changes) return res.status(404).json({ erro: 'Escola não encontrada.' });
  res.status(204).end();
});

export default router;
