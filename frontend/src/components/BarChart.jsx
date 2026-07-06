// Gráfico de barras horizontais simples, feito só com CSS (sem bibliotecas).
// Acessível: rótulo e valor são texto; a barra colorida é apenas decorativa.
export default function BarChart({ dados, cor = 'var(--cor-primaria)' }) {
  if (!dados || dados.length === 0) {
    return <p className="vazio">Sem dados.</p>;
  }
  // Base mínima de 1 para evitar divisão por zero quando tudo é 0.
  const maximo = Math.max(1, ...dados.map((d) => d.valor));

  return (
    <ul className="grafico-barras" role="list">
      {dados.map((d) => (
        <li key={d.rotulo} className="barra-linha">
          <span className="barra-rotulo">{d.rotulo}</span>
          <span className="barra-trilho">
            <span
              className="barra-preenchida"
              style={{ width: `${(d.valor / maximo) * 100}%`, background: cor }}
              aria-hidden="true"
            />
          </span>
          <span className="barra-valor">{d.valor}</span>
        </li>
      ))}
    </ul>
  );
}
