// Redistribui as datas dos ALERTAS já existentes ao longo dos últimos ~6 meses,
// para o gráfico "Evolução no tempo (por mês)" do Painel analítico ganhar forma.
//
// NÃO destrutivo: altera SÓ as datas (criado_em/atualizado_em do alerta e o
// criado_em do histórico correspondente). Não toca em eixo/nível/status/conteúdo.
// Idempotente na prática: reexecutar reaplica a mesma distribuição.
//
// Uso:  npm run seed:datas   (dentro da pasta backend)

import db from './db.js';
import { dataFicticia } from './datas-ficticias.js';

const alertas = db.prepare('SELECT id FROM alertas ORDER BY id').all();
if (alertas.length === 0) {
  console.error('Nenhum alerta encontrado. Rode antes: npm run seed:alertas');
  process.exit(1);
}

const atualizarAlerta = db.prepare('UPDATE alertas SET criado_em = ?, atualizado_em = ? WHERE id = ?');
const atualizarHist = db.prepare('UPDATE alerta_historico SET criado_em = ? WHERE alerta_id = ?');

const aplicar = db.transaction(() => {
  alertas.forEach((a, i) => {
    const data = dataFicticia(i);
    atualizarAlerta.run(data, data, a.id);
    atualizarHist.run(data, a.id);
  });
});
aplicar();

// Resumo por mês — confirma o espalhamento.
const porMes = db
  .prepare("SELECT strftime('%Y-%m', criado_em) AS mes, COUNT(*) AS total FROM alertas GROUP BY mes ORDER BY mes")
  .all();

console.log(`Datas redistribuídas em ${alertas.length} alertas. Distribuição por mês:`);
porMes.forEach((m) => console.log(`  ${m.mes}: ${m.total}`));
