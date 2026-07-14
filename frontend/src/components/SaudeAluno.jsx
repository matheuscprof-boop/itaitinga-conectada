// Eixo A — Saúde Escolar do aluno: vacinação (status + checklist + carteira),
// alergias, doenças pré-existentes, medicamentos controlados (com receita) e
// registro diário de sintomas.
import { useEffect, useState } from 'react';
import { api, ROTULOS } from '../api.js';

// Utilitários para tratar as seleções de checklist como CSV (formato do banco).
function csvArr(v) {
  return v ? String(v).split(',').filter(Boolean) : [];
}
function toggleCsv(v, item) {
  const arr = csvArr(v);
  return (arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]).join(',');
}

export default function SaudeAluno({ alunoId, sexo = null, podeEditar = true }) {
  const feminino = sexo === 'feminino';
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
        vacinas_tomadas: dados.vacinas_tomadas || '',
        doencas: dados.doencas || '',
        doencas_outros: dados.doencas_outros,
        usa_medicamento_controlado: dados.usa_medicamento_controlado ? 1 : 0,
        medicamentos: dados.medicamentos,
        peso: dados.peso ?? '',
        altura: dados.altura ?? '',
        // Gestação: só enviada para alunas (o backend também garante isso).
        gravidez: feminino && dados.gravidez ? 1 : 0,
        gravidez_historico: feminino && dados.gravidez_historico ? 1 : 0,
        // Pré-natal só faz sentido para gestante atual.
        pre_natal: feminino && dados.gravidez && dados.pre_natal ? 1 : 0,
      });
      setOk('Dados de saúde salvos.');
    } catch (err) { setErro(err.message); }
  }

  // Envia um anexo (carteira de vacina ou receita) e mescla a resposta.
  async function enviarAnexo(tipo, file) {
    if (!file) return;
    setErro(''); setOk('');
    const fd = new FormData();
    fd.append('arquivo', file);
    try {
      const atualizado = tipo === 'cartao'
        ? await api.enviarCartaoVacina(alunoId, fd)
        : await api.enviarReceita(alunoId, fd);
      setDados((d) => ({ ...d, ...atualizado }));
      setOk('Anexo enviado.');
    } catch (err) { setErro(err.message); }
  }

  async function removerAnexo(tipo) {
    setErro(''); setOk('');
    try {
      const atualizado = tipo === 'cartao'
        ? await api.removerCartaoVacina(alunoId)
        : await api.removerReceita(alunoId);
      setDados((d) => ({ ...d, ...atualizado }));
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

  // IMC = peso / altura². Só exibe quando ambos são números válidos.
  const imc = (() => {
    const p = Number(String(dados.peso ?? '').replace(',', '.'));
    const a = Number(String(dados.altura ?? '').replace(',', '.'));
    if (!(p > 0) || !(a > 0)) return null;
    const valor = p / (a * a);
    const faixa = valor < 18.5 ? 'abaixo do peso'
      : valor < 25 ? 'peso adequado'
      : valor < 30 ? 'sobrepeso' : 'obesidade';
    return { valor: valor.toFixed(1), faixa };
  })();

  // Bloco reutilizável de anexo (link p/ ver + enviar/remover).
  function Anexo({ tipo, arquivo, rotulo }) {
    return (
      <div className="anexo-saude">
        {arquivo ? (
          <span className="anexo-saude__atual">
            <a href={arquivo} target="_blank" rel="noreferrer">📎 Ver {rotulo}</a>
            {podeEditar && (
              <button type="button" className="btn btn--link" onClick={() => removerAnexo(tipo)}>
                remover
              </button>
            )}
          </span>
        ) : (
          <span className="vazio">Nenhum arquivo anexado.</span>
        )}
        {podeEditar && (
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => { enviarAnexo(tipo, e.target.files[0]); e.target.value = ''; }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="eixo-secao">
      {erro && <p className="alerta-erro" role="alert">{erro}</p>}
      {ok && <p className="alerta-sucesso" role="status">{ok}</p>}

      <form className="card form" onSubmit={salvar}>
        <h3>Vacinação</h3>
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
            <label htmlFor="vacinas">Observações sobre vacinas</label>
            <input id="vacinas" value={dados.vacinas || ''} disabled={!podeEditar}
              onChange={(e) => setDados({ ...dados, vacinas: e.target.value })} />
          </div>
        </div>

        <fieldset className="checklist">
          <legend>Vacinas tomadas</legend>
          {Object.entries(ROTULOS.vacinas).map(([v, r]) => (
            <label key={v} className="checklist-item">
              <input type="checkbox" disabled={!podeEditar}
                checked={csvArr(dados.vacinas_tomadas).includes(v)}
                onChange={() => setDados({ ...dados, vacinas_tomadas: toggleCsv(dados.vacinas_tomadas, v) })} />
              {r}
            </label>
          ))}
        </fieldset>

        <div className="campo">
          <label>Carteira de vacina (imagem ou PDF)</label>
          <Anexo tipo="cartao" arquivo={dados.cartao_vacina} rotulo="carteira" />
          {dados.vacinacao_atualizada_em && (
            <small className="vazio">Atualizada em {dados.vacinacao_atualizada_em}</small>
          )}
        </div>

        <h3>Saúde geral</h3>
        <div className="eixo-grid">
          <div className="campo">
            <label htmlFor="peso">Peso (kg)</label>
            <input id="peso" type="number" step="0.1" min="0" inputMode="decimal"
              value={dados.peso ?? ''} disabled={!podeEditar} placeholder="ex.: 54.5"
              onChange={(e) => setDados({ ...dados, peso: e.target.value })} />
          </div>
          <div className="campo">
            <label htmlFor="altura">Altura (m)</label>
            <input id="altura" type="number" step="0.01" min="0" inputMode="decimal"
              value={dados.altura ?? ''} disabled={!podeEditar} placeholder="ex.: 1.62"
              onChange={(e) => setDados({ ...dados, altura: e.target.value })} />
          </div>
        </div>
        {imc && (
          <p className="vazio" aria-live="polite">
            IMC calculado: <strong>{imc.valor}</strong> ({imc.faixa})
          </p>
        )}

        <div className="campo">
          <label htmlFor="alergias">Alergias graves</label>
          <textarea id="alergias" rows={2} value={dados.alergias || ''} disabled={!podeEditar}
            onChange={(e) => setDados({ ...dados, alergias: e.target.value })} />
        </div>

        {feminino && (
          <>
            <h3>Saúde da estudante (gestação)</h3>
            <label className="checklist-item">
              <input type="checkbox" disabled={!podeEditar}
                checked={!!dados.gravidez}
                onChange={(e) => setDados({ ...dados, gravidez: e.target.checked ? 1 : 0, pre_natal: e.target.checked ? dados.pre_natal : 0 })} />
              Está grávida atualmente
            </label>
            {!!dados.gravidez && (
              <label className="checklist-item" style={{ marginLeft: '1.5rem' }}>
                <input type="checkbox" disabled={!podeEditar}
                  checked={!!dados.pre_natal}
                  onChange={(e) => setDados({ ...dados, pre_natal: e.target.checked ? 1 : 0 })} />
                Faz acompanhamento pré-natal
              </label>
            )}
            <label className="checklist-item">
              <input type="checkbox" disabled={!podeEditar}
                checked={!!dados.gravidez_historico}
                onChange={(e) => setDados({ ...dados, gravidez_historico: e.target.checked ? 1 : 0 })} />
              Possui histórico de gestação
            </label>
          </>
        )}

        <fieldset className="checklist">
          <legend>Doenças / condições pré-existentes</legend>
          {Object.entries(ROTULOS.doencas).map(([d, r]) => (
            <label key={d} className="checklist-item">
              <input type="checkbox" disabled={!podeEditar}
                checked={csvArr(dados.doencas).includes(d)}
                onChange={() => setDados({ ...dados, doencas: toggleCsv(dados.doencas, d) })} />
              {r}
            </label>
          ))}
        </fieldset>
        <div className="campo">
          <label htmlFor="doencas-outros">Outras condições (não listadas)</label>
          <input id="doencas-outros" value={dados.doencas_outros || ''} disabled={!podeEditar}
            onChange={(e) => setDados({ ...dados, doencas_outros: e.target.value })} />
        </div>

        <h3>Medicamentos controlados</h3>
        <label className="checklist-item">
          <input type="checkbox" disabled={!podeEditar}
            checked={!!dados.usa_medicamento_controlado}
            onChange={(e) => setDados({ ...dados, usa_medicamento_controlado: e.target.checked ? 1 : 0 })} />
          O aluno usa medicamento controlado de uso contínuo
        </label>
        {!!dados.usa_medicamento_controlado && (
          <>
            <div className="campo">
              <label htmlFor="medicamentos">Quais medicamentos</label>
              <textarea id="medicamentos" rows={2} value={dados.medicamentos || ''} disabled={!podeEditar}
                onChange={(e) => setDados({ ...dados, medicamentos: e.target.value })} />
            </div>
            <div className="campo">
              <label>Receita médica (imagem ou PDF)</label>
              <Anexo tipo="receita" arquivo={dados.receita} rotulo="receita" />
            </div>
          </>
        )}

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
