// Eixo A — Saúde Escolar do aluno: vacinação, alergias e registro de sintomas.
import { useEffect, useState } from 'react';
import { api, ROTULOS } from '../api.js';

export default function SaudeAluno({ alunoId, podeEditar = true }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [sintoma, setSintoma] = useState({ sintomas: '', observacao: '' });
  const [avisoSurto, setAvisoSurto] = useState('');

  function carregar() {
    api.obterSaude(alunoId).then(setDados).catch((e) => setErro(e.message));
  }
  useEffect(carregar, [alunoId]);

  async function salvar(e) {
    e.preventDefault();
    setErro(''); setOk('');
    try {
      await api.salvarSaude(alunoId, {
        vacinacao_status: dados.vacinacao_status,
        vacinas: dados.vacinas,
        alergias: dados.alergias,
      });
      setOk('Dados de saúde salvos.');
    } catch (err) { setErro(err.message); }
  }

  async function registrarSintoma(e) {
    e.preventDefault();
    setErro(''); setAvisoSurto('');
    if (!sintoma.sintomas.trim()) { setErro('Informe ao menos um sintoma.'); return; }
    try {
      const resp = await api.registrarSintoma(alunoId, sintoma);
      if (resp.surto) {
        setAvisoSurto(`Atenção: ${resp.surto.alunos_afetados} alunos da turma relataram sintomas semelhantes (${resp.surto.sintomas}).`);
      }
      setSintoma({ sintomas: '', observacao: '' });
      carregar();
    } catch (err) { setErro(err.message); }
  }

  if (!dados) return <p className="vazio" role="status">Carregando…</p>;

  return (
    <div className="eixo-secao">
      {erro && <p className="alerta-erro" role="alert">{erro}</p>}
      {ok && <p className="alerta-sucesso" role="status">{ok}</p>}

      <form className="card form" onSubmit={salvar}>
        <h3>Vacinação e alergias</h3>
        <div className="eixo-grid">
          <div className="campo">
            <label htmlFor="vac">Situação da vacinação</label>
            <select id="vac" value={dados.vacinacao_status}
              disabled={!podeEditar}
              onChange={(e) => setDados({ ...dados, vacinacao_status: e.target.value })}>
              {Object.entries(ROTULOS.vacinacao).map(([v, r]) => (
                <option key={v} value={v}>{r}</option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="vacinas">Histórico de vacinas</label>
            <input id="vacinas" value={dados.vacinas || ''} disabled={!podeEditar}
              onChange={(e) => setDados({ ...dados, vacinas: e.target.value })} />
          </div>
        </div>
        <div className="campo">
          <label htmlFor="alergias">Alergias graves</label>
          <textarea id="alergias" rows={2} value={dados.alergias || ''} disabled={!podeEditar}
            onChange={(e) => setDados({ ...dados, alergias: e.target.value })} />
        </div>
        {podeEditar && <button className="btn btn--primario" type="submit">Salvar saúde</button>}
      </form>

      <form className="card form" onSubmit={registrarSintoma}>
        <h3>Registro diário de sintomas</h3>
        {avisoSurto && <p className="aviso-risco" role="alert">{avisoSurto}</p>}
        <div className="campo">
          <label htmlFor="sintomas">Sintomas (separe por vírgula)</label>
          <input id="sintomas" value={sintoma.sintomas} disabled={!podeEditar}
            placeholder="ex.: febre, tosse"
            onChange={(e) => setSintoma({ ...sintoma, sintomas: e.target.value })} />
        </div>
        <div className="campo">
          <label htmlFor="obs-sintoma">Observação</label>
          <input id="obs-sintoma" value={sintoma.observacao} disabled={!podeEditar}
            onChange={(e) => setSintoma({ ...sintoma, observacao: e.target.value })} />
        </div>
        {podeEditar && <button className="btn" type="submit">Registrar sintoma</button>}

        <h4>Últimos registros</h4>
        {dados.sintomas && dados.sintomas.length > 0 ? (
          <ul className="lista-sintomas" role="list">
            {dados.sintomas.map((s) => (
              <li key={s.id} className="sintoma-item">
                <strong>{s.data}</strong> — {s.sintomas}
                {s.observacao ? ` (${s.observacao})` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <p className="vazio">Nenhum sintoma registrado.</p>
        )}
      </form>
    </div>
  );
}
