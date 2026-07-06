// Formulário de registro de alerta para um aluno específico.
// Os eixos e níveis vêm das referências carregadas da API.
import { useState } from 'react';
import { ROTULOS } from '../api.js';

const EIXOS = ['frequencia', 'desempenho', 'socioemocional'];
const NIVEIS = ['baixo', 'medio', 'alto'];

export default function AlertaForm({ alunoId, onSalvar }) {
  const [form, setForm] = useState({ eixo: 'frequencia', nivel: 'medio', titulo: '', descricao: '' });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  function alterar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      await onSalvar({ ...form, aluno_id: alunoId });
      setForm({ eixo: 'frequencia', nivel: 'medio', titulo: '', descricao: '' });
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form className="card form" onSubmit={enviar} aria-labelledby="titulo-form-alerta">
      <h3 id="titulo-form-alerta">Registrar alerta</h3>

      {erro && (
        <p className="alerta-erro" role="alert">
          {erro}
        </p>
      )}

      <div className="form-grid">
        <div className="campo">
          <label htmlFor="eixo">Eixo</label>
          <select id="eixo" value={form.eixo} onChange={(e) => alterar('eixo', e.target.value)}>
            {EIXOS.map((valor) => (
              <option key={valor} value={valor}>
                {ROTULOS.eixo[valor]}
              </option>
            ))}
          </select>
        </div>

        <div className="campo">
          <label htmlFor="nivel">Nível de risco</label>
          <select id="nivel" value={form.nivel} onChange={(e) => alterar('nivel', e.target.value)}>
            {NIVEIS.map((valor) => (
              <option key={valor} value={valor}>
                {ROTULOS.nivel[valor]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="campo">
        <label htmlFor="titulo-alerta">
          Título <span aria-hidden="true">*</span>
        </label>
        <input
          id="titulo-alerta"
          type="text"
          required
          value={form.titulo}
          onChange={(e) => alterar('titulo', e.target.value)}
        />
      </div>

      <div className="campo">
        <label htmlFor="descricao-alerta">Descrição</label>
        <textarea
          id="descricao-alerta"
          rows="3"
          value={form.descricao}
          onChange={(e) => alterar('descricao', e.target.value)}
        />
      </div>

      <div className="form-acoes">
        <button type="submit" className="btn btn--primario" disabled={salvando}>
          {salvando ? 'Registrando…' : 'Registrar alerta'}
        </button>
      </div>
    </form>
  );
}
