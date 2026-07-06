// Gráfico de rosca (donut) em SVG, sem bibliotecas.
// Acessível: a legenda lista rótulo, valor e percentual em texto; o SVG é
// marcado como decorativo (aria-hidden) pois a informação está na legenda.
import { corPorIndice } from './PaletaGraficos.js';

export default function DonutChart({ dados }) {
  const itens = (dados || []).filter((d) => d.valor > 0);
  const total = itens.reduce((s, d) => s + d.valor, 0);

  if (total === 0) return <p className="vazio">Sem dados.</p>;

  const raio = 60;
  const circ = 2 * Math.PI * raio;
  let acumulado = 0;

  return (
    <div className="donut">
      <svg viewBox="0 0 160 160" className="donut-svg" aria-hidden="true">
        <g transform="translate(80,80) rotate(-90)">
          <circle r={raio} fill="none" stroke="#eef1f6" strokeWidth="20" />
          {itens.map((d, i) => {
            const fracao = d.valor / total;
            const traco = fracao * circ;
            const seg = (
              <circle
                key={d.rotulo}
                r={raio}
                fill="none"
                stroke={corPorIndice(i)}
                strokeWidth="20"
                strokeDasharray={`${traco} ${circ - traco}`}
                strokeDashoffset={-acumulado}
              />
            );
            acumulado += traco;
            return seg;
          })}
        </g>
        <text x="80" y="80" className="donut-total" textAnchor="middle" dominantBaseline="middle">
          {total}
        </text>
      </svg>

      <ul className="donut-legenda" role="list">
        {itens.map((d, i) => (
          <li key={d.rotulo}>
            <span className="legenda-cor" style={{ background: corPorIndice(i) }} aria-hidden="true" />
            <span className="legenda-rotulo">{d.rotulo}</span>
            <span className="legenda-valor">
              {d.valor} ({Math.round((d.valor / total) * 100)}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
