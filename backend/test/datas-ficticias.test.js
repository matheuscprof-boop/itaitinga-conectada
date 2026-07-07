// Testa o helper de datas fictícias usado pelo seed/redistribuição de alertas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dataFicticia } from '../src/datas-ficticias.js';

// Data-base fixa para tornar o teste determinístico.
const BASE = new Date(2026, 6, 7, 12, 0, 0); // 2026-07-07 (mês 6 = julho)

test('formato "YYYY-MM-DD HH:MM:SS" válido', () => {
  for (let i = 0; i < 50; i++) {
    assert.match(dataFicticia(i, BASE), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  }
});

test('nenhuma data no futuro em relação à base', () => {
  for (let i = 0; i < 200; i++) {
    const dt = new Date(dataFicticia(i, BASE).replace(' ', 'T'));
    assert.ok(dt <= BASE, `índice ${i} gerou data futura: ${dt.toISOString()}`);
  }
});

test('espalha por vários meses (não fica num ponto só)', () => {
  const meses = new Set();
  for (let i = 0; i < 80; i++) meses.add(dataFicticia(i, BASE).slice(0, 7));
  // Últimos ~6 meses → deve cobrir pelo menos 5 meses distintos.
  assert.ok(meses.size >= 5, `esperava >=5 meses distintos, veio ${meses.size}`);
});

test('determinístico: mesmo índice + base → mesma data', () => {
  assert.equal(dataFicticia(42, BASE), dataFicticia(42, BASE));
});
