// Datas fictícias para os alertas de demonstração.
//
// Espalha as datas ao longo dos últimos ~6 meses com uma leve tendência de mais
// registros nos meses recentes — assim o gráfico "Evolução no tempo (por mês)"
// (LineChart do Painel analítico) tem forma, em vez de um único ponto.
//
// Determinístico por índice: dado o mesmo índice e a mesma data-base, devolve
// sempre a mesma data — não usa aleatoriedade (facilita testar).

// Meses-atrás (0 = mês atual) repetidos conforme o peso. O mês atual aparece
// mais vezes e 5 meses atrás menos vezes → curva suave de crescimento.
const PESOS_POR_MES = [6, 5, 4, 3, 2, 1]; // índice = meses atrás
const BALDE_MESES = [];
PESOS_POR_MES.forEach((peso, mesesAtras) => {
  for (let k = 0; k < peso; k++) BALDE_MESES.push(mesesAtras);
});

const zero = (n) => String(n).padStart(2, '0');

// Devolve "YYYY-MM-DD HH:MM:SS" (formato que o SQLite entende em strftime).
export function dataFicticia(indice, base = new Date()) {
  const mesesAtras = BALDE_MESES[indice % BALDE_MESES.length];
  let dia = ((indice * 13) % 26) + 1; // 1..26 → dia sempre válido em qualquer mês
  // Não deixa o mês atual gerar data no futuro (limita ao dia de hoje).
  if (mesesAtras === 0) dia = Math.min(dia, Math.max(1, base.getDate()));

  const hora = (indice * 5) % 24;
  const min = (indice * 17) % 60;
  // Construir por componentes lida com a virada de ano quando o mês fica negativo.
  let d = new Date(base.getFullYear(), base.getMonth() - mesesAtras, dia, hora, min, 0);
  // Trava de segurança: nunca no futuro (cobre o caso "mesmo dia, hora maior").
  while (d > base) d = new Date(d.getTime() - 24 * 60 * 60 * 1000);
  return (
    `${d.getFullYear()}-${zero(d.getMonth() + 1)}-${zero(d.getDate())} ` +
    `${zero(d.getHours())}:${zero(d.getMinutes())}:${zero(d.getSeconds())}`
  );
}
