// Eixo C — Vida Escolar do aluno: frequência, desempenho, projetos e o
// Diário de Bordo (fotos).
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Logbook from './Logbook.jsx';

export default function VidaEscolarAluno({ alunoId, podeEditar = true }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');

  function carregar() {
    api.obterVidaEscolar(alunoId).then(setDados).catch((e) => setErro(e.message));
  }
  useEffect(carregar, [alunoId]);

  async function salvar(e) {
    e.preventDefault();
    setErro(''); setOk('');
    try {
      await api.salvarVidaEscolar(alunoId, {
        frequencia_percentual: dados.frequencia_percentual,
        desempenho_media: dados.desempenho_media,
        projetos: dados.projetos,
        observacoes: dados.observacoes,
        pcd: dados.pcd ? 1 : 0,
        pcd_condicao: dados.pcd_condicao,
      });
      setOk('Dados de vida escolar salvos.');
    } catch (err) { setErro(err.message); }
  }

  // Anexa/remove o PEI e mescla a resposta no estado.
  async function enviarPei(file) {
    if (!file) return;
    setErro(''); setOk('');
    const fd = new FormData();
    fd.append('arquivo', file);
    try {
      const atualizado = await api.enviarPei(alunoId, fd);
      setDados((d) => ({ ...d, ...atualizado }));
      setOk('PEI anexado.');
    } catch (err) { setErro(err.message); }
  }
  async function removerPei() {
    setErro(''); setOk('');
    try {
      const atualizado = await api.removerPei(alunoId);
      setDados((d) => ({ ...d, ...atualizado }));
    } catch (err) { setErro(err.message); }
  }

  if (!dados) return <p className="vazio" role="status">Carregando…</p>;

  return (
    <div className="eixo-secao">
      {erro && <p className="alerta-erro" role="alert">{erro}</p>}
      {ok && <p className="alerta-sucesso" role="status">{ok}</p>}

      <form className="card form" onSubmit={salvar}>
        <h3>Frequência, desempenho e projetos</h3>
        <div className="eixo-grid">
          <div className="campo">
            <label htmlFor="freq">Frequência (%)</label>
            <input id="freq" type="number" step="any" min="0" max="100" disabled={!podeEditar}
              value={dados.frequencia_percentual ?? ''}
              onChange={(e) => setDados({ ...dados, frequencia_percentual: e.target.value === '' ? null : Number(e.target.value) })} />
          </div>
          <div className="campo">
            <label htmlFor="media">Desempenho (média)</label>
            <input id="media" type="number" step="any" disabled={!podeEditar}
              value={dados.desempenho_media ?? ''}
              onChange={(e) => setDados({ ...dados, desempenho_media: e.target.value === '' ? null : Number(e.target.value) })} />
          </div>
        </div>
        <div className="campo">
          <label htmlFor="projetos">Participação em projetos</label>
          <input id="projetos" value={dados.projetos || ''} disabled={!podeEditar}
            placeholder="ex.: Guardiões dos Biomas"
            onChange={(e) => setDados({ ...dados, projetos: e.target.value })} />
        </div>
        <div className="campo">
          <label htmlFor="obs-vida">Observações</label>
          <textarea id="obs-vida" rows={2} value={dados.observacoes || ''} disabled={!podeEditar}
            onChange={(e) => setDados({ ...dados, observacoes: e.target.value })} />
        </div>

        <h3>Educação inclusiva (PcD)</h3>
        <label className="checklist-item">
          <input type="checkbox" disabled={!podeEditar}
            checked={!!dados.pcd}
            onChange={(e) => setDados({ ...dados, pcd: e.target.checked ? 1 : 0 })} />
          Aluno com deficiência (PcD)
        </label>
        {!!dados.pcd && (
          <>
            <div className="campo">
              <label htmlFor="pcd-condicao">Qual a condição / deficiência</label>
              <input id="pcd-condicao" value={dados.pcd_condicao || ''} disabled={!podeEditar}
                placeholder="ex.: Deficiência auditiva; TEA; deficiência intelectual"
                onChange={(e) => setDados({ ...dados, pcd_condicao: e.target.value })} />
            </div>
            <div className="campo">
              <label>PEI — Plano Educacional Individualizado (imagem ou PDF)</label>
              <div className="anexo-saude">
                {dados.pei ? (
                  <span className="anexo-saude__atual">
                    <a href={dados.pei} target="_blank" rel="noreferrer">📎 Ver PEI</a>
                    {podeEditar && (
                      <button type="button" className="btn btn--link" onClick={removerPei}>remover</button>
                    )}
                  </span>
                ) : (
                  <span className="vazio">Nenhum arquivo anexado.</span>
                )}
                {podeEditar && (
                  <input type="file" accept="image/*,application/pdf"
                    onChange={(e) => { enviarPei(e.target.files[0]); e.target.value = ''; }} />
                )}
              </div>
            </div>
          </>
        )}

        {podeEditar && <button className="btn btn--primario" type="submit">Salvar vida escolar</button>}
      </form>

      <div className="card">
        <Logbook alunoId={alunoId} fotos={dados.fotos || []} podeEditar={podeEditar} onAtualizar={carregar} />
      </div>
    </div>
  );
}
