// Geocodificação de endereços (endereço → latitude/longitude).
// Base: /api/geo  — protegida (equipe; cidadão bloqueado no server.js).
//
// Faz a consulta ao serviço público do OpenStreetMap/Nominatim NO SERVIDOR
// (evita problemas de CORS e concentra o User-Agent/limites num só ponto). Se
// não houver internet, responde 502 e a UI orienta a marcar o ponto no mapa.

import { Router } from 'express';

const router = Router();

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'ItaitingaConectada/1.0 (app municipal de acompanhamento estudantil)';

// GET /api/geo/geocodificar?endereco=...
router.get('/geocodificar', async (req, res) => {
  const endereco = (req.query.endereco ?? '').toString().trim();
  if (!endereco) {
    return res.status(400).json({ erro: 'Informe um endereço para localizar.' });
  }

  // Enviesa a busca para Itaitinga/CE quando o texto não cita o município.
  const consulta = /itaitinga/i.test(endereco) ? endereco : `${endereco}, Itaitinga, Ceará, Brasil`;
  const url = `${NOMINATIM}?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(consulta)}`;

  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), 8000);
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'pt-BR' },
      signal: controlador.signal,
    });
    if (!resp.ok) {
      return res.status(502).json({ erro: 'Serviço de geocodificação indisponível no momento.' });
    }
    const lista = await resp.json();
    if (!Array.isArray(lista) || lista.length === 0) {
      return res.status(404).json({
        erro: 'Endereço não encontrado. Refine o texto ou marque o ponto no mapa.',
      });
    }
    const r = lista[0];
    res.json({
      latitude: Number(r.lat),
      longitude: Number(r.lon),
      endereco_encontrado: r.display_name,
    });
  } catch (e) {
    console.error('[geo] Falha na geocodificação:', e.message);
    res.status(502).json({
      erro: 'Não foi possível consultar o serviço de geocodificação (sem internet?). Marque o ponto no mapa.',
    });
  } finally {
    clearTimeout(timeout);
  }
});

export default router;
