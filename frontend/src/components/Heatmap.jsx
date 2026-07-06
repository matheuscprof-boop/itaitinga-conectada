// Mapa de calor (mapeamento) em forma de tabela cruzada.
// É uma tabela HTML real (acessível): os números ficam visíveis e a cor de
// fundo indica a intensidade (proporcional ao maior valor da matriz).
export default function Heatmap({ linhas, colunas, celulas, rotuloLinha, rotuloColuna, cor = '31, 95, 191' }) {
  if (!linhas?.length || !colunas?.length) {
    return <p className="vazio">Sem dados para o mapeamento.</p>;
  }

  // Maior valor para normalizar a intensidade das cores.
  let maximo = 1;
  for (const l of linhas) {
    for (const c of colunas) {
      maximo = Math.max(maximo, celulas?.[l]?.[c] ?? 0);
    }
  }

  const rotL = rotuloLinha || ((v) => v);
  const rotC = rotuloColuna || ((v) => v);

  return (
    <div className="heatmap-scroll">
      <table className="heatmap">
        <thead>
          <tr>
            <th scope="col" className="heatmap-canto"></th>
            {colunas.map((c) => (
              <th key={c} scope="col">{rotC(c)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l}>
              <th scope="row">{rotL(l)}</th>
              {colunas.map((c) => {
                const valor = celulas?.[l]?.[c] ?? 0;
                const intensidade = valor / maximo; // 0..1
                return (
                  <td
                    key={c}
                    style={{ background: `rgba(${cor}, ${valor === 0 ? 0 : 0.12 + intensidade * 0.78})` }}
                    className={intensidade > 0.55 ? 'celula-forte' : ''}
                  >
                    {valor > 0 ? valor : '—'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
