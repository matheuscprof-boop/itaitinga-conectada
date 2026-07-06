// Gráfico de linha (evolução no tempo) em SVG, sem bibliotecas.
// Acessível: além do desenho, há uma tabela equivalente só para leitores de tela.
export default function LineChart({ pontos, cor = '#1f5fbf' }) {
  const dados = pontos || [];
  if (dados.length === 0) return <p className="vazio">Sem dados.</p>;

  const passo = 64;
  const padX = 36;
  const padY = 26;
  const altura = 190;
  const largura = Math.max(320, padX * 2 + (dados.length - 1) * passo);
  const maximo = Math.max(1, ...dados.map((d) => d.valor));

  const px = (i) => padX + i * passo;
  const py = (v) => altura - padY - (v / maximo) * (altura - padY * 2);

  const linha = dados.map((d, i) => `${px(i)},${py(d.valor)}`).join(' ');
  const area = `${px(0)},${altura - padY} ${linha} ${px(dados.length - 1)},${altura - padY}`;

  return (
    <div className="line-chart">
      <div className="line-scroll">
        <svg viewBox={`0 0 ${largura} ${altura}`} width={largura} height={altura} aria-hidden="true">
          {/* eixo base */}
          <line x1={padX} y1={altura - padY} x2={largura - padX / 2} y2={altura - padY} stroke="#d5dbe3" />
          {/* área preenchida */}
          <polygon points={area} fill={cor} fillOpacity="0.12" />
          {/* linha */}
          <polyline points={linha} fill="none" stroke={cor} strokeWidth="2.5"
            strokeLinejoin="round" strokeLinecap="round" />
          {/* pontos e valores */}
          {dados.map((d, i) => (
            <g key={d.rotulo}>
              <circle cx={px(i)} cy={py(d.valor)} r="4" fill={cor} />
              <text x={px(i)} y={py(d.valor) - 10} textAnchor="middle" className="line-valor">
                {d.valor}
              </text>
              <text x={px(i)} y={altura - padY + 16} textAnchor="middle" className="line-rotulo">
                {d.rotulo}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Equivalente textual para tecnologias assistivas. */}
      <table className="sr-only">
        <caption>Evolução ao longo do tempo</caption>
        <thead>
          <tr><th scope="col">Período</th><th scope="col">Total</th></tr>
        </thead>
        <tbody>
          {dados.map((d) => (
            <tr key={d.rotulo}><td>{d.rotulo}</td><td>{d.valor}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
