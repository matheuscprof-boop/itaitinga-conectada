// Eixo B — Assistência Social (dados por aluno).
// Base: /api/assistencia
// Beneficiário de programas, composição familiar e geolocalização residencial.
// Ao salvar a geolocalização, cruza com as áreas de risco mapeadas pelo
// município (distância de Haversine) e sinaliza/notifica quando aplicável.

import { Router } from 'express';
import db from '../db.js';
import { alunoNoEscopo } from '../alunoEscopo.js';
import { notificar } from '../notificador.js';

const router = Router();

const obter = db.prepare('SELECT * FROM assistencia_aluno WHERE aluno_id = ?');
const upsert = db.prepare(`
  INSERT INTO assistencia_aluno
    (aluno_id, bolsa_familia, programas, composicao_familiar, endereco, latitude, longitude, em_area_risco, atualizado_em)
  VALUES
    (@aluno_id, @bolsa_familia, @programas, @composicao_familiar, @endereco, @latitude, @longitude, @em_area_risco, datetime('now'))
  ON CONFLICT(aluno_id) DO UPDATE SET
    bolsa_familia = excluded.bolsa_familia,
    programas = excluded.programas,
    composicao_familiar = excluded.composicao_familiar,
    endereco = excluded.endereco,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    em_area_risco = excluded.em_area_risco,
    atualizado_em = datetime('now')
`);
const listarAreas = db.prepare('SELECT * FROM areas_risco');

// Distância aproximada em km entre dois pontos (fórmula de Haversine).
function distanciaKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Retorna a área de risco que contém o ponto (ou null).
function areaDeRisco(lat, lon) {
  if (lat == null || lon == null) return null;
  for (const area of listarAreas.all()) {
    if (distanciaKm(lat, lon, area.latitude, area.longitude) <= area.raio_km) return area;
  }
  return null;
}

function numeroOuNulo(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// GET /api/assistencia/:alunoId
router.get('/:alunoId', (req, res) => {
  const aluno = alunoNoEscopo(req, req.params.alunoId);
  if (!aluno) return res.status(404).json({ erro: 'Aluno não encontrado.' });
  const dados = obter.get(aluno.id) || {
    aluno_id: aluno.id,
    bolsa_familia: 0,
    programas: null,
    composicao_familiar: null,
    endereco: null,
    latitude: null,
    longitude: null,
    em_area_risco: 0,
  };
  res.json(dados);
});

// PUT /api/assistencia/:alunoId → cria/atualiza e recalcula área de risco
router.put('/:alunoId', (req, res) => {
  const aluno = alunoNoEscopo(req, req.params.alunoId);
  if (!aluno) return res.status(404).json({ erro: 'Aluno não encontrado.' });

  const latitude = numeroOuNulo(req.body.latitude);
  const longitude = numeroOuNulo(req.body.longitude);
  const anterior = obter.get(aluno.id);
  const area = areaDeRisco(latitude, longitude);
  const emRisco = area ? 1 : 0;

  upsert.run({
    aluno_id: aluno.id,
    bolsa_familia: req.body.bolsa_familia ? 1 : 0,
    programas: req.body.programas || null,
    composicao_familiar: req.body.composicao_familiar || null,
    endereco: (req.body.endereco ?? '').toString().trim() || null,
    latitude,
    longitude,
    em_area_risco: emRisco,
    // exposto abaixo apenas para a lógica de notificação
  });

  // Notifica a gestão quando o aluno passa a estar em área de risco.
  if (emRisco && (!anterior || anterior.em_area_risco !== 1)) {
    notificar({
      titulo: `Aluno em área de risco: ${aluno.nome}`,
      mensagem: `A residência de ${aluno.nome} (turma ${aluno.turma}) está na área de risco "${area.nome}".`,
      escolaId: aluno.escola_id,
      turma: aluno.turma,
    });
  }

  const salvo = obter.get(aluno.id);
  res.json({ ...salvo, area_risco_nome: area ? area.nome : null });
});

// GET /api/assistencia/areas/risco → lista das áreas mapeadas (para o mapa)
router.get('/areas/risco', (_req, res) => {
  res.json(listarAreas.all());
});

export default router;
