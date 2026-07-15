// Panorama municipal de Saúde — mapeamento das estudantes gestantes e com
// histórico de gestação (lista + mapa). Acesso: perfis de gestão.
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import MapaLeaflet from '../components/MapaLeaflet.jsx';

// Idade em anos a partir da data de nascimento (AAAA-MM-DD).
function idade(dataNasc) {
  if (!dataNasc) return null;
  const n = new Date(dataNasc + 'T00:00:00');
  if (Number.isNaN(n.getTime())) return null;
  const hoje = new Date();
  let a = hoje.getFullYear() - n.getFullYear();
  const m = hoje.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < n.getDate())) a -= 1;
  return a;
}

function escaparHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export default function PanoramaSaude() {
  const [linhas, setLinhas] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api.listarGestantes().then(setLinhas).catch((e) => setErro(e.message));
  }, []);

  const atuais = useMemo(() => (linhas || []).filter((r) => r.gravidez), [linhas]);
  const historico = useMemo(
    () => (linhas || []).filter((r) => r.gravidez_historico && !r.gravidez),
    [linhas]
  );
  const semPreNatal = useMemo(() => atuais.filter((r) => !r.pre_natal), [atuais]);

  // Marcadores das gestantes atuais que têm localização residencial cadastrada
  // (vem do eixo Assistência). Sem pré-natal recebe um marcador de alerta.
  const marcadores = useMemo(
    () =>
      atuais
        .filter((r) => r.latitude != null && r.longitude != null)
        .map((r) => ({
          id: r.id,
          latitude: r.latitude,
          longitude: r.longitude,
          emoji: r.pre_natal ? '🤰' : '⚠️',
          emojiLabel: r.pre_natal ? 'Gestante com pré-natal' : 'Gestante sem pré-natal',
          popup:
            `<strong>${escaparHtml(r.nome)}</strong><br/>` +
            `🏠 Residência: ${escaparHtml(r.endereco || 'não informada')}<br/>` +
            `<span style="color:#5b6675">${escaparHtml(r.escola_nome || '—')} · ${escaparHtml(r.turma)}</span><br/>` +
            `Pré-natal: <em>${r.pre_natal ? 'sim' : 'não'}</em>`,
        })),
    [atuais]
  );
  const comLocalizacao = marcadores.length;

  if (erro) return <p className="alerta-erro" role="alert">{erro}</p>;
  if (!linhas) return <p className="vazio" role="status">Carregando…</p>;

  return (
    <div className="painel area-relatorio">
      <div className="secao-cabecalho">
        <h2>Panorama de Saúde — Gestantes</h2>
        <button className="btn nao-imprimir" onClick={() => window.print()}>
          Imprimir / PDF
        </button>
      </div>
      <p className="subtitulo">
        Mapeamento das estudantes gestantes e com histórico de gestação no seu escopo.
      </p>

      {/* Cartões-resumo */}
      <div className="resumo-cards">
        <div className="cartao-resumo cartao-resumo--info">
          <strong>{atuais.length}</strong>
          <span>Gestantes atuais</span>
        </div>
        <div className="cartao-resumo cartao-resumo--alerta">
          <strong>{semPreNatal.length}</strong>
          <span>Sem acompanhamento pré-natal</span>
        </div>
        <div className="cartao-resumo">
          <strong>{historico.length}</strong>
          <span>Com histórico de gestação</span>
        </div>
      </div>

      {semPreNatal.length > 0 && (
        <p className="aviso-risco" role="alert">
          Atenção: {semPreNatal.length} gestante(s) sem acompanhamento pré-natal registrado.
        </p>
      )}

      {/* Mapa */}
      <div className="card">
        <h3>Mapa das gestantes (por residência)</h3>
        {comLocalizacao > 0 ? (
          <>
            <MapaLeaflet marcadores={marcadores} altura={360} />
            <ul className="legenda-mapa" aria-label="Legenda do mapa">
              <li><span className="legenda-emoji" aria-hidden="true">🤰</span> Com pré-natal</li>
              <li><span className="legenda-emoji" aria-hidden="true">⚠️</span> Sem pré-natal</li>
            </ul>
            <small className="vazio">
              {comLocalizacao} de {atuais.length} gestante(s) com localização residencial cadastrada
              (o endereço é informado no eixo Assistência).
            </small>
          </>
        ) : (
          <p className="vazio">
            Nenhuma gestante com localização residencial cadastrada ainda. Informe o endereço
            na aba <strong>Assistência</strong> do aluno para vê-la no mapa.
          </p>
        )}
      </div>

      {/* Lista: gestantes atuais */}
      <div className="card">
        <h3>Gestantes atuais ({atuais.length})</h3>
        {atuais.length === 0 ? (
          <p className="vazio">Nenhuma estudante marcada como gestante.</p>
        ) : (
          <div className="tabela-scroll">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Nome</th><th>Escola</th><th>Turma</th><th>Idade</th>
                  <th>Pré-natal</th><th>Responsável</th><th>Contato</th>
                </tr>
              </thead>
              <tbody>
                {atuais.map((r) => (
                  <tr key={r.id} className={r.pre_natal ? '' : 'linha-alerta'}>
                    <td>{r.nome}</td>
                    <td>{r.escola_nome || '—'}</td>
                    <td>{r.turma}</td>
                    <td>{idade(r.data_nascimento) ?? '—'}</td>
                    <td>
                      <span className={`badge ${r.pre_natal ? 'badge--status-resolvido' : 'badge--status-aberto'}`}>
                        {r.pre_natal ? 'Sim' : 'Não'}
                      </span>
                    </td>
                    <td>{r.responsavel_nome || '—'}</td>
                    <td>{r.responsavel_contato || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lista: histórico de gestação */}
      <div className="card">
        <h3>Com histórico de gestação ({historico.length})</h3>
        {historico.length === 0 ? (
          <p className="vazio">Nenhuma estudante com histórico de gestação.</p>
        ) : (
          <div className="tabela-scroll">
            <table className="tabela">
              <thead>
                <tr><th>Nome</th><th>Escola</th><th>Turma</th><th>Idade</th></tr>
              </thead>
              <tbody>
                {historico.map((r) => (
                  <tr key={r.id}>
                    <td>{r.nome}</td>
                    <td>{r.escola_nome || '—'}</td>
                    <td>{r.turma}</td>
                    <td>{idade(r.data_nascimento) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
