// Formulário de cadastro/edição de aluno.
// Recebe `aluno` (opcional, para edição) e callbacks onSalvar / onCancelar.
import { useState } from 'react';

const VAZIO = {
  nome: '',
  matricula: '',
  turma: '',
  escola_id: '',
  data_nascimento: '',
  responsavel_nome: '',
  responsavel_contato: '',
  observacoes: '',
};

// `escolas` só é passado para a Secretaria (que escolhe a escola do aluno).
export default function AlunoForm({ aluno, escolas, onSalvar, onCancelar }) {
  // Preenche o formulário com o aluno existente (edição) ou vazio (novo).
  const [form, setForm] = useState({ ...VAZIO, ...aluno });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const editando = Boolean(aluno?.id);

  function alterar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      await onSalvar(form);
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form className="card form" onSubmit={enviar} aria-labelledby="titulo-form-aluno">
      <h2 id="titulo-form-aluno">{editando ? 'Editar aluno' : 'Novo aluno'}</h2>

      {erro && (
        <p className="alerta-erro" role="alert">
          {erro}
        </p>
      )}

      <div className="form-grid">
        <div className="campo">
          <label htmlFor="nome">
            Nome completo <span aria-hidden="true">*</span>
          </label>
          <input
            id="nome"
            type="text"
            required
            value={form.nome}
            onChange={(e) => alterar('nome', e.target.value)}
          />
        </div>

        <div className="campo">
          <label htmlFor="matricula">
            Matrícula <span aria-hidden="true">*</span>
          </label>
          <input
            id="matricula"
            type="text"
            required
            value={form.matricula}
            onChange={(e) => alterar('matricula', e.target.value)}
          />
        </div>

        <div className="campo">
          <label htmlFor="turma">
            Turma <span aria-hidden="true">*</span>
          </label>
          <input
            id="turma"
            type="text"
            required
            placeholder="Ex.: 9º A"
            value={form.turma}
            onChange={(e) => alterar('turma', e.target.value)}
          />
        </div>

        {/* Seleção de escola apenas ao cadastrar (Secretaria). */}
        {escolas?.length > 0 && !editando && (
          <div className="campo">
            <label htmlFor="escola">
              Escola <span aria-hidden="true">*</span>
            </label>
            <select
              id="escola"
              required
              value={form.escola_id}
              onChange={(e) => alterar('escola_id', e.target.value)}
            >
              <option value="">Selecione…</option>
              {escolas.map((e) => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>
          </div>
        )}

        <div className="campo">
          <label htmlFor="data_nascimento">Data de nascimento</label>
          <input
            id="data_nascimento"
            type="date"
            value={form.data_nascimento || ''}
            onChange={(e) => alterar('data_nascimento', e.target.value)}
          />
        </div>

        <div className="campo">
          <label htmlFor="responsavel_nome">Responsável</label>
          <input
            id="responsavel_nome"
            type="text"
            value={form.responsavel_nome || ''}
            onChange={(e) => alterar('responsavel_nome', e.target.value)}
          />
        </div>

        <div className="campo">
          <label htmlFor="responsavel_contato">Contato do responsável</label>
          <input
            id="responsavel_contato"
            type="text"
            placeholder="Telefone ou e-mail"
            value={form.responsavel_contato || ''}
            onChange={(e) => alterar('responsavel_contato', e.target.value)}
          />
        </div>
      </div>

      <div className="campo">
        <label htmlFor="observacoes">Observações</label>
        <textarea
          id="observacoes"
          rows="3"
          value={form.observacoes || ''}
          onChange={(e) => alterar('observacoes', e.target.value)}
        />
      </div>

      <div className="form-acoes">
        <button type="submit" className="btn btn--primario" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        <button type="button" className="btn" onClick={onCancelar} disabled={salvando}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
