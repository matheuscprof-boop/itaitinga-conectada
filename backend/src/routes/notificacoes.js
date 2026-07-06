// Feed de notificações da equipe de gestão (alertas de nível alto),
// escopado por escola. Base: /api/notificacoes
// (protegida por perfil de gestão no server.js)

import { Router } from 'express';
import db from '../db.js';
import { escolaEfetiva, ehMunicipal } from '../escopo.js';

const router = Router();

const obter = db.prepare('SELECT * FROM notificacoes WHERE id = ?');
const marcarLida = db.prepare('UPDATE notificacoes SET lida = 1 WHERE id = ?');

// Monta a cláusula WHERE de escopo (escola) + filtro opcional de não lidas.
function escopo(req, apenasNaoLidas) {
  const escola = escolaEfetiva(req);
  const cond = [];
  const params = {};
  if (escola != null) {
    cond.push('escola_id = @escola');
    params.escola = escola;
  }
  if (apenasNaoLidas) cond.push('lida = 0');
  const where = cond.length ? ` WHERE ${cond.join(' AND ')}` : '';
  return { where, params };
}

// GET /api/notificacoes?nao_lidas=1  → lista + contagem de não lidas
router.get('/', (req, res) => {
  const { where, params } = escopo(req, req.query.nao_lidas);
  const lista = db
    .prepare(`SELECT * FROM notificacoes${where} ORDER BY criado_em DESC, id DESC LIMIT 100`)
    .all(params);

  const semNaoLidas = escopo(req, true);
  const naoLidas = db
    .prepare(`SELECT COUNT(*) AS total FROM notificacoes${semNaoLidas.where}`)
    .get(semNaoLidas.params).total;

  res.json({ notificacoes: lista, nao_lidas: naoLidas });
});

// PATCH /api/notificacoes/:id  → marca uma como lida (respeitando o escopo)
router.patch('/:id', (req, res) => {
  const notif = obter.get(req.params.id);
  if (!notif) return res.status(404).json({ erro: 'Notificação não encontrada.' });
  if (!ehMunicipal(req.usuario) && notif.escola_id !== req.usuario.escola_id) {
    return res.status(404).json({ erro: 'Notificação não encontrada.' });
  }
  marcarLida.run(notif.id);
  res.json(obter.get(notif.id));
});

// POST /api/notificacoes/marcar-todas-lidas  → marca todas do escopo como lidas
router.post('/marcar-todas-lidas', (req, res) => {
  const { where, params } = escopo(req, true);
  db.prepare(`UPDATE notificacoes SET lida = 1${where}`).run(params);
  res.json({ ok: true });
});

export default router;
