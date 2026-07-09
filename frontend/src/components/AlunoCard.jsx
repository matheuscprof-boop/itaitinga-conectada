// Cartão de informações do aluno (visão de leitura, usado na tela de detalhe).
import { ROTULOS } from '../api.js';

export default function AlunoCard({ aluno, podeGerenciar, onEditar, onRemover }) {
  // Formata a data ISO (AAAA-MM-DD) para o padrão brasileiro.
  const nascimento = aluno.data_nascimento
    ? new Date(aluno.data_nascimento + 'T00:00:00').toLocaleDateString('pt-BR')
    : '—';

  return (
    <article className="card card--info" aria-labelledby="titulo-card-aluno">
      <div className="secao-cabecalho">
        <h2 id="titulo-card-aluno">{aluno.nome}</h2>
        {podeGerenciar && (
          <div className="form-acoes">
            <button className="btn" onClick={onEditar}>
              Editar
            </button>
            <button className="btn btn--perigo" onClick={onRemover}>
              Remover
            </button>
          </div>
        )}
      </div>

      <dl className="lista-descricao">
        <div>
          <dt>Matrícula</dt>
          <dd>{aluno.matricula}</dd>
        </div>
        <div>
          <dt>Turma</dt>
          <dd>{aluno.turma}</dd>
        </div>
        {aluno.sexo && (
          <div>
            <dt>Sexo</dt>
            <dd>{ROTULOS.sexo[aluno.sexo] || aluno.sexo}</dd>
          </div>
        )}
        <div>
          <dt>Nascimento</dt>
          <dd>{nascimento}</dd>
        </div>
        <div>
          <dt>Responsável</dt>
          <dd>{aluno.responsavel_nome || '—'}</dd>
        </div>
        <div>
          <dt>Contato</dt>
          <dd>{aluno.responsavel_contato || '—'}</dd>
        </div>
      </dl>

      {aluno.observacoes && (
        <div className="observacoes">
          <h3>Observações</h3>
          <p>{aluno.observacoes}</p>
        </div>
      )}
    </article>
  );
}
