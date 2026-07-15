// Relatórios agregados e exportação de alertas.
// Base: /api/relatorios
// Todas as rotas aceitam os mesmos filtros de /api/alertas
// (eixo, nivel, status, turma, de, ate).

import { Router } from 'express';
import db from '../db.js';
import { montarFiltrosAlertas } from '../filtros.js';
import { EIXOS, NIVEIS, STATUS, CATEGORIAS_ALERTA } from '../constants.js';
import { filtrosComEscola, escolaEfetiva } from '../escopo.js';

const router = Router();

const base = `
  FROM alertas al
  JOIN alunos a ON a.id = al.aluno_id
`;

// Conta ocorrências por uma coluna, aplicando os filtros recebidos.
function contarPor(coluna, where, params) {
  const linhas = db
    .prepare(`SELECT al.${coluna} AS chave, COUNT(*) AS total ${base}${where} GROUP BY al.${coluna}`)
    .all(params);
  return Object.fromEntries(linhas.map((l) => [l.chave, l.total]));
}

// Garante que todas as chaves esperadas apareçam (com zero quando faltarem).
function completar(mapa, chaves) {
  const resultado = {};
  for (const chave of chaves) resultado[chave] = mapa[chave] ?? 0;
  return resultado;
}

// GET /api/relatorios/resumo  → agregados por eixo, nível, status e turma
router.get('/resumo', (req, res) => {
  const { where, params } = montarFiltrosAlertas(filtrosComEscola(req));

  const total = db.prepare(`SELECT COUNT(*) AS total ${base}${where}`).get(params).total;
  const porTurma = db
    .prepare(`SELECT a.turma AS turma, COUNT(*) AS total ${base}${where} GROUP BY a.turma ORDER BY total DESC`)
    .all(params);

  // Por categoria (bullying/racismo/…): só conta alertas com categoria definida,
  // e devolve apenas as categorias presentes (ordenadas por total desc).
  const porCategoriaMapa = contarPor('categoria', where, params);
  delete porCategoriaMapa[null]; // ignora os alertas sem categoria
  const porCategoria = Object.entries(porCategoriaMapa)
    .filter(([chave]) => CATEGORIAS_ALERTA.includes(chave))
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total);

  res.json({
    total,
    por_eixo: completar(contarPor('eixo', where, params), EIXOS),
    por_nivel: completar(contarPor('nivel', where, params), NIVEIS),
    por_status: completar(contarPor('status', where, params), STATUS),
    por_turma: porTurma,
    por_categoria: porCategoria,
  });
});

// GET /api/relatorios/alertas.csv  → exporta os alertas filtrados em CSV
router.get('/alertas.csv', (req, res) => {
  const { where, params } = montarFiltrosAlertas(filtrosComEscola(req));
  const linhas = db
    .prepare(
      `SELECT al.id, a.nome AS aluno, a.turma, al.eixo, al.nivel, al.categoria, al.titulo,
              al.status, al.criado_em
       ${base}${where} ORDER BY al.criado_em DESC`
    )
    .all(params);

  const colunas = ['id', 'aluno', 'turma', 'eixo', 'nivel', 'categoria', 'titulo', 'status', 'criado_em'];
  const csv = [
    colunas.join(','),
    ...linhas.map((linha) => colunas.map((c) => formatarCampoCsv(linha[c])).join(',')),
  ].join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="alertas.csv"');
  res.send('﻿' + csv); // BOM para o Excel reconhecer o UTF-8
});

// Escapa aspas e envolve em aspas quando necessário (formato CSV padrão).
function formatarCampoCsv(valor) {
  const texto = valor == null ? '' : String(valor);
  if (/[",\r\n]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

// =====================================================================
// Painel analítico: séries e matrizes (mapeamentos) por dimensão.
// As dimensões são uma allowlist → seguras para interpolar no SQL.
// =====================================================================
const DIM_EXPR = {
  eixo: 'al.eixo',
  nivel: 'al.nivel',
  status: 'al.status',
  turma: 'a.turma',
  escola: 'a.escola_id',
  mes: "strftime('%Y-%m', al.criado_em)",
};

// Chaves esperadas de uma dimensão. Para eixo/nível/status usa a ordem
// canônica (mostra todas, mesmo com zero); para turma/mês usa os valores
// presentes, ordenados.
function chavesDim(dim, valoresPresentes) {
  const canon = { eixo: EIXOS, nivel: NIVEIS, status: STATUS }[dim];
  if (canon) return canon;
  return [...new Set(valoresPresentes.filter((v) => v != null))].sort();
}

function dimensaoValida(nome, padrao) {
  return Object.prototype.hasOwnProperty.call(DIM_EXPR, nome) ? nome : padrao;
}

// GET /api/relatorios/serie?dimensao=eixo|nivel|status|turma|mes&<filtros>
// → contagem agrupada por uma dimensão (para barras, rosca ou linha).
router.get('/serie', (req, res) => {
  const dim = dimensaoValida(req.query.dimensao, 'eixo');
  const { where, params } = montarFiltrosAlertas(filtrosComEscola(req));
  const linhas = db
    .prepare(`SELECT ${DIM_EXPR[dim]} AS chave, COUNT(*) AS total ${base}${where} GROUP BY chave`)
    .all(params);
  const mapa = Object.fromEntries(linhas.map((l) => [l.chave, l.total]));
  const serie = chavesDim(dim, linhas.map((l) => l.chave)).map((chave) => ({
    chave,
    total: mapa[chave] ?? 0,
  }));
  res.json({ dimensao: dim, serie });
});

// GET /api/relatorios/matriz?linha=eixo&coluna=turma&<filtros>
// → tabela cruzada (mapeamento) linha × coluna, ideal para heatmap.
router.get('/matriz', (req, res) => {
  const linhaDim = dimensaoValida(req.query.linha, 'eixo');
  const colDim = dimensaoValida(req.query.coluna, 'turma');
  const { where, params } = montarFiltrosAlertas(filtrosComEscola(req));
  const dados = db
    .prepare(
      `SELECT ${DIM_EXPR[linhaDim]} AS linha, ${DIM_EXPR[colDim]} AS coluna, COUNT(*) AS total
       ${base}${where} GROUP BY linha, coluna`
    )
    .all(params);

  const celulas = {};
  for (const d of dados) {
    if (!celulas[d.linha]) celulas[d.linha] = {};
    celulas[d.linha][d.coluna] = d.total;
  }
  res.json({
    linhaDim,
    colDim,
    linhas: chavesDim(linhaDim, dados.map((d) => d.linha)),
    colunas: chavesDim(colDim, dados.map((d) => d.coluna)),
    celulas,
  });
});

// GET /api/relatorios/mapa
// → por escola: coordenadas + contagem de alertas (para o mapa geográfico).
// Aplica apenas o escopo de escola (mostra todas as escolas do escopo, mesmo
// as sem alertas). Alertas resolvidos não contam como "abertos"/"altos".
router.get('/mapa', (req, res) => {
  const escola = escolaEfetiva(req); // número (uma escola) ou null (todas)
  const cond = escola == null ? '' : ' WHERE e.id = @escola';
  const params = escola == null ? {} : { escola };

  const linhas = db
    .prepare(
      `SELECT e.id AS escola_id, e.nome, e.municipio, e.latitude, e.longitude,
              COUNT(al.id) AS total,
              COALESCE(SUM(CASE WHEN al.status != 'resolvido' THEN 1 ELSE 0 END), 0) AS abertos,
              COALESCE(SUM(CASE WHEN al.nivel = 'alto' AND al.status != 'resolvido' THEN 1 ELSE 0 END), 0) AS altos
       FROM escolas e
       LEFT JOIN alunos a ON a.escola_id = e.id
       LEFT JOIN alertas al ON al.aluno_id = a.id
       ${cond}
       GROUP BY e.id
       ORDER BY e.nome COLLATE NOCASE`
    )
    .all(params);

  res.json(linhas);
});

export default router;
