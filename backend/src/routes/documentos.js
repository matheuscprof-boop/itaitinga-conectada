// Módulo de Documentos do aluno (registros completos, por categoria).
// Base: /api/documentos
// Visualização por qualquer equipe no escopo; envio/remoção pela gestão
// (coordenação/direção/secretaria), como "gestores escolares".

import { Router } from 'express';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import db from '../db.js';
import { exigirPerfil } from '../auth.js';
import { PERFIS_GESTAO, CATEGORIAS_DOCUMENTO } from '../constants.js';
import { alunoNoEscopo } from '../alunoEscopo.js';
import { uploadDocumento, caminhoPublico, UPLOADS_DIR } from '../uploads.js';

const router = Router();
const podeGerenciar = exigirPerfil(...PERFIS_GESTAO);

const listar = db.prepare(
  'SELECT * FROM aluno_documentos WHERE aluno_id = ? ORDER BY criado_em DESC, id DESC'
);
const inserir = db.prepare(`
  INSERT INTO aluno_documentos (aluno_id, arquivo, nome_original, categoria, descricao, autor_nome)
  VALUES (@aluno_id, @arquivo, @nome_original, @categoria, @descricao, @autor_nome)
`);
const obter = db.prepare('SELECT * FROM aluno_documentos WHERE id = ?');
const remover = db.prepare('DELETE FROM aluno_documentos WHERE id = ?');

// GET /api/documentos/:alunoId → lista os documentos do aluno
router.get('/:alunoId', (req, res) => {
  const aluno = alunoNoEscopo(req, req.params.alunoId);
  if (!aluno) return res.status(404).json({ erro: 'Aluno não encontrado.' });
  res.json(listar.all(aluno.id));
});

// POST /api/documentos/:alunoId → envia um documento (multipart, campo "arquivo")
router.post('/:alunoId', podeGerenciar, uploadDocumento, (req, res) => {
  const aluno = alunoNoEscopo(req, req.params.alunoId);
  if (!aluno) return res.status(404).json({ erro: 'Aluno não encontrado.' });
  if (!req.file) return res.status(400).json({ erro: 'Envie um arquivo no campo "arquivo".' });

  const categoria = CATEGORIAS_DOCUMENTO.includes(req.body.categoria) ? req.body.categoria : 'outro';
  const { lastInsertRowid } = inserir.run({
    aluno_id: aluno.id,
    arquivo: caminhoPublico(req.file),
    nome_original: req.file.originalname || null,
    categoria,
    descricao: req.body.descricao || null,
    autor_nome: req.usuario?.nome ?? null,
  });
  res.status(201).json(obter.get(lastInsertRowid));
});

// DELETE /api/documentos/:docId → remove um documento (gestão no escopo)
router.delete('/:docId', podeGerenciar, async (req, res) => {
  const doc = obter.get(req.params.docId);
  if (!doc) return res.status(404).json({ erro: 'Documento não encontrado.' });
  const aluno = alunoNoEscopo(req, doc.aluno_id);
  if (!aluno) return res.status(404).json({ erro: 'Documento não encontrado.' });

  remover.run(doc.id);
  if (doc.arquivo) {
    const nome = doc.arquivo.replace(/^\/uploads\//, '');
    await unlink(join(UPLOADS_DIR, nome)).catch(() => {});
  }
  res.status(204).end();
});

export default router;
