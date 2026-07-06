// Lista de alunos com busca. Cada linha mostra dados essenciais e a
// quantidade de alertas abertos, servindo de porta de entrada para o detalhe.

export default function AlunoList({ alunos, busca, podeCriar, onBuscar, onAbrir, onNovo }) {
  return (
    <section aria-labelledby="titulo-lista-alunos">
      <div className="secao-cabecalho">
        <h2 id="titulo-lista-alunos">Alunos</h2>
        {podeCriar && (
          <button className="btn btn--primario" onClick={onNovo}>
            + Novo aluno
          </button>
        )}
      </div>

      <div className="campo campo--busca">
        <label htmlFor="busca-aluno">Buscar por nome, matrícula ou turma</label>
        <input
          id="busca-aluno"
          type="search"
          value={busca}
          placeholder="Digite para filtrar…"
          onChange={(e) => onBuscar(e.target.value)}
        />
      </div>

      {alunos.length === 0 ? (
        <p className="vazio">Nenhum aluno encontrado.</p>
      ) : (
        <ul className="lista" role="list">
          {alunos.map((aluno) => (
            <li key={aluno.id} className="lista-item">
              <button
                className="lista-item-botao"
                onClick={() => onAbrir(aluno.id)}
                aria-label={`Abrir detalhes de ${aluno.nome}`}
              >
                <div>
                  <strong>{aluno.nome}</strong>
                  <span className="lista-item-sub">
                    {aluno.turma} · Matrícula {aluno.matricula}
                    {aluno.escola_nome ? ` · ${aluno.escola_nome}` : ''}
                  </span>
                </div>
                {aluno.total_alertas > 0 && (
                  <span className="contador-alertas" title="Alertas em aberto">
                    {aluno.total_alertas} alerta{aluno.total_alertas > 1 ? 's' : ''}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
