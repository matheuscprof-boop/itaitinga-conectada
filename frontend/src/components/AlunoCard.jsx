// Cartão de informações do aluno (visão de leitura, usado na tela de detalhe).
import { useState } from 'react';
import { api, ROTULOS } from '../api.js';

// Iniciais do nome para o avatar quando não há foto.
function iniciais(nome) {
  const partes = String(nome || '').trim().split(/\s+/);
  return ((partes[0]?.[0] || '') + (partes[partes.length - 1]?.[0] || '')).toUpperCase() || '?';
}

export default function AlunoCard({ aluno, podeGerenciar, onEditar, onRemover, onAtualizar }) {
  const [erroFoto, setErroFoto] = useState('');
  // Formata a data ISO (AAAA-MM-DD) para o padrão brasileiro.
  const nascimento = aluno.data_nascimento
    ? new Date(aluno.data_nascimento + 'T00:00:00').toLocaleDateString('pt-BR')
    : '—';

  async function enviarFoto(file) {
    if (!file) return;
    setErroFoto('');
    const fd = new FormData();
    fd.append('foto', file);
    try {
      await api.enviarFotoAluno(aluno.id, fd);
      onAtualizar?.();
    } catch (err) { setErroFoto(err.message); }
  }
  async function removerFoto() {
    if (!confirm('Remover a foto do estudante?')) return;
    setErroFoto('');
    try {
      await api.removerFotoAluno(aluno.id);
      onAtualizar?.();
    } catch (err) { setErroFoto(err.message); }
  }

  return (
    <article className="card card--info" aria-labelledby="titulo-card-aluno">
      <div className="secao-cabecalho">
        <div className="aluno-identidade">
          <div className="aluno-avatar">
            {aluno.foto
              ? <img src={aluno.foto} alt={`Foto de ${aluno.nome}`} loading="lazy" />
              : <span aria-hidden="true">{iniciais(aluno.nome)}</span>}
          </div>
          <h2 id="titulo-card-aluno">{aluno.nome}</h2>
        </div>
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

      {podeGerenciar && (
        <div className="aluno-foto-acoes">
          <label className="btn btn--suave aluno-foto-botao">
            {aluno.foto ? 'Trocar foto' : 'Adicionar foto'}
            <input type="file" accept="image/*" hidden
              onChange={(e) => { enviarFoto(e.target.files[0]); e.target.value = ''; }} />
          </label>
          {aluno.foto && (
            <button type="button" className="btn btn--link" onClick={removerFoto}>remover foto</button>
          )}
          {erroFoto && <span className="alerta-erro" role="alert">{erroFoto}</span>}
        </div>
      )}

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
