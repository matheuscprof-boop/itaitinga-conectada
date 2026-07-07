// Eixo C — Vida Escolar (dados por aluno).
// Base: /api/vida-escolar
// Frequência, desempenho, projetos e o "Diário de Bordo" (fotos do aluno).

import { Router } from 'express';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import db from '../db.js';
import { alunoNoEscopo } from '../alunoEscopo.js';
import { uploadFoto, uploadDocumento, caminhoPublico, UPLOADS_DIR } from '../uploads.js';

const router = Router();

const obter = db.prepare('SELECT * FROM vida_escolar_aluno WHERE aluno_id = ?');
// Campos textuais/numéricos. O anexo do PEI fica FORA deste upsert (upsert
// próprio) para não ser apagado ao salvar o formulário sem reenviar o arquivo.
const upsert = db.prepare(`
  INSERT INTO vida_escolar_aluno
    (aluno_id, frequencia_percentual, desempenho_media, projetos, observacoes, pcd, pcd_condicao, atualizado_em)
  VALUES
    (@aluno_id, @frequencia_percentual, @desempenho_media, @projetos, @observacoes, @pcd, @pcd_condicao, datetime('now'))
  ON CONFLICT(aluno_id) DO UPDATE SET
    frequencia_percentual = excluded.frequencia_percentual,
    desempenho_media = excluded.desempenho_media,
    projetos = excluded.projetos,
    observacoes = excluded.observacoes,
    pcd = excluded.pcd,
    pcd_condicao = excluded.pcd_condicao,
    atualizado_em = datetime('now')
`);

// Grava só o caminho do PEI (cria a linha com os defaults do schema se preciso).
const salvarPei = db.prepare(`
  INSERT INTO vida_escolar_aluno (aluno_id, pei, atualizado_em)
  VALUES (@aluno_id, @arquivo, datetime('now'))
  ON CONFLICT(aluno_id) DO UPDATE SET
    pei = excluded.pei,
    atualizado_em = datetime('now')
`);

const listarFotos = db.prepare(
  'SELECT * FROM logbook_fotos WHERE aluno_id = ? ORDER BY criado_em DESC, id DESC'
);
const inserirFoto = db.prepare(`
  INSERT INTO logbook_fotos (aluno_id, arquivo, legenda, autor_nome)
  VALUES (@aluno_id, @arquivo, @legenda, @autor_nome)
`);
const obterFoto = db.prepare('SELECT * FROM logbook_fotos WHERE id = ?');
const removerFoto = db.prepare('DELETE FROM logbook_fotos WHERE id = ?');

function numeroOuNulo(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Remove o arquivo físico de um anexo antigo (ignora se já não existir).
async function removerArquivo(caminhoPub) {
  if (!caminhoPub) return;
  const nome = caminhoPub.replace(/^\/uploads\//, '');
  await unlink(join(UPLOADS_DIR, nome)).catch(() => {});
}

// GET /api/vida-escolar/:alunoId → dados + fotos do diário
router.get('/:alunoId', (req, res) => {
  const aluno = alunoNoEscopo(req, req.params.alunoId);
  if (!aluno) return res.status(404).json({ erro: 'Aluno não encontrado.' });
  const dados = obter.get(aluno.id) || {
    aluno_id: aluno.id,
    frequencia_percentual: null,
    desempenho_media: null,
    projetos: null,
    observacoes: null,
    pcd: 0,
    pcd_condicao: null,
    pei: null,
  };
  dados.fotos = listarFotos.all(aluno.id);
  res.json(dados);
});

// PUT /api/vida-escolar/:alunoId → cria/atualiza dados de vida escolar
router.put('/:alunoId', (req, res) => {
  const aluno = alunoNoEscopo(req, req.params.alunoId);
  if (!aluno) return res.status(404).json({ erro: 'Aluno não encontrado.' });

  const freq = numeroOuNulo(req.body.frequencia_percentual);
  if (freq != null && (freq < 0 || freq > 100)) {
    return res.status(400).json({ erro: 'A frequência deve estar entre 0 e 100.' });
  }
  const pcd = req.body.pcd ? 1 : 0;
  upsert.run({
    aluno_id: aluno.id,
    frequencia_percentual: freq,
    desempenho_media: numeroOuNulo(req.body.desempenho_media),
    projetos: req.body.projetos || null,
    observacoes: req.body.observacoes || null,
    pcd,
    // Só guarda a condição se o aluno for marcado como PcD.
    pcd_condicao: pcd ? (req.body.pcd_condicao || null) : null,
  });
  res.json(obter.get(aluno.id));
});

// POST /api/vida-escolar/:alunoId/pei → anexa o PEI (multipart, campo "arquivo")
router.post('/:alunoId/pei', uploadDocumento, async (req, res) => {
  const aluno = alunoNoEscopo(req, req.params.alunoId);
  if (!aluno) return res.status(404).json({ erro: 'Aluno não encontrado.' });
  if (!req.file) return res.status(400).json({ erro: 'Envie um arquivo no campo "arquivo".' });

  const anterior = obter.get(aluno.id)?.pei;
  salvarPei.run({ aluno_id: aluno.id, arquivo: caminhoPublico(req.file) });
  await removerArquivo(anterior); // remove o anexo substituído
  res.status(201).json(obter.get(aluno.id));
});

// DELETE /api/vida-escolar/:alunoId/pei → remove o PEI anexado
router.delete('/:alunoId/pei', async (req, res) => {
  const aluno = alunoNoEscopo(req, req.params.alunoId);
  if (!aluno) return res.status(404).json({ erro: 'Aluno não encontrado.' });
  const atual = obter.get(aluno.id)?.pei;
  salvarPei.run({ aluno_id: aluno.id, arquivo: null });
  await removerArquivo(atual);
  res.json(obter.get(aluno.id));
});

// GET /api/vida-escolar/:alunoId/fotos → galeria do diário de bordo
router.get('/:alunoId/fotos', (req, res) => {
  const aluno = alunoNoEscopo(req, req.params.alunoId);
  if (!aluno) return res.status(404).json({ erro: 'Aluno não encontrado.' });
  res.json(listarFotos.all(aluno.id));
});

// POST /api/vida-escolar/:alunoId/fotos → envia uma foto (multipart, campo "foto")
router.post('/:alunoId/fotos', uploadFoto, (req, res) => {
  const aluno = alunoNoEscopo(req, req.params.alunoId);
  if (!aluno) return res.status(404).json({ erro: 'Aluno não encontrado.' });
  if (!req.file) return res.status(400).json({ erro: 'Envie uma imagem no campo "foto".' });

  const { lastInsertRowid } = inserirFoto.run({
    aluno_id: aluno.id,
    arquivo: caminhoPublico(req.file),
    legenda: req.body.legenda || null,
    autor_nome: req.usuario?.nome ?? null,
  });
  res.status(201).json(obterFoto.get(lastInsertRowid));
});

// DELETE /api/vida-escolar/fotos/:fotoId → remove uma foto do diário
router.delete('/fotos/:fotoId', async (req, res) => {
  const foto = obterFoto.get(req.params.fotoId);
  if (!foto) return res.status(404).json({ erro: 'Foto não encontrada.' });
  const aluno = alunoNoEscopo(req, foto.aluno_id);
  if (!aluno) return res.status(404).json({ erro: 'Foto não encontrada.' });

  removerFoto.run(foto.id);
  // Remove o arquivo físico (ignora se já não existir).
  if (foto.arquivo) {
    const nome = foto.arquivo.replace(/^\/uploads\//, '');
    await unlink(join(UPLOADS_DIR, nome)).catch(() => {});
  }
  res.status(204).end();
});

export default router;
