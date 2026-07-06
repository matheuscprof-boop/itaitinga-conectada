// Lista de alertas de um aluno, agrupada por eixo pedagógico.
// Cada alerta permite avançar o status, ver a linha do tempo (histórico) e
// registrar comentários. A remoção fica restrita a perfis de gestão.
import { useState } from 'react';
import Badge from './Badge.jsx';
import { api, ROTULOS } from '../api.js';

const EIXOS = ['frequencia', 'desempenho', 'socioemocional'];

// Próximo status no fluxo aberto → em_andamento → resolvido.
const PROXIMO_STATUS = { aberto: 'em_andamento', em_andamento: 'resolvido' };

// Formata a data/hora ISO do SQLite para o padrão brasileiro.
function formatarData(iso) {
  if (!iso) return '';
  // O SQLite grava "AAAA-MM-DD HH:MM:SS" em UTC.
  return new Date(iso.replace(' ', 'T') + 'Z').toLocaleString('pt-BR');
}

export default function AlertaList({ alertas, podeRemover, onMudarStatus, onRemover }) {
  if (alertas.length === 0) {
    return <p className="vazio">Nenhum alerta registrado para este aluno.</p>;
  }

  return (
    <div className="alertas-por-eixo">
      {EIXOS.map((eixo) => {
        const doEixo = alertas.filter((a) => a.eixo === eixo);
        if (doEixo.length === 0) return null;
        return (
          <section key={eixo} aria-labelledby={`eixo-${eixo}`}>
            <h4 id={`eixo-${eixo}`} className="eixo-titulo">
              {ROTULOS.eixo[eixo]}
            </h4>
            <ul className="lista" role="list">
              {doEixo.map((alerta) => (
                <AlertaItem
                  key={alerta.id}
                  alerta={alerta}
                  podeRemover={podeRemover}
                  onMudarStatus={onMudarStatus}
                  onRemover={onRemover}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

// Um item de alerta com controle próprio da linha do tempo.
function AlertaItem({ alerta, podeRemover, onMudarStatus, onRemover }) {
  const [aberto, setAberto] = useState(false);
  const [historico, setHistorico] = useState(null);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);

  const proximo = PROXIMO_STATUS[alerta.status];

  async function alternarHistorico() {
    const novo = !aberto;
    setAberto(novo);
    if (novo && historico === null) {
      setHistorico(await api.listarHistorico(alerta.id));
    }
  }

  async function enviarComentario(e) {
    e.preventDefault();
    if (!comentario.trim()) return;
    setEnviando(true);
    try {
      await api.comentar(alerta.id, comentario);
      setComentario('');
      setHistorico(await api.listarHistorico(alerta.id));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <li className="card card--alerta">
      <div className="alerta-topo">
        <strong>{alerta.titulo}</strong>
        <div className="alerta-selos">
          <Badge tipo="nivel" valor={alerta.nivel} />
          <Badge tipo="status" valor={alerta.status} />
        </div>
      </div>
      {alerta.descricao && <p className="alerta-descricao">{alerta.descricao}</p>}

      <div className="form-acoes">
        {proximo && (
          <button className="btn btn--pequeno" onClick={() => onMudarStatus(alerta.id, proximo)}>
            Marcar como “{ROTULOS.status[proximo]}”
          </button>
        )}
        <button
          className="btn btn--pequeno"
          onClick={alternarHistorico}
          aria-expanded={aberto}
        >
          {aberto ? 'Ocultar histórico' : 'Ver histórico'}
        </button>
        {podeRemover && (
          <button
            className="btn btn--pequeno btn--perigo"
            onClick={() => onRemover(alerta.id)}
          >
            Remover
          </button>
        )}
      </div>

      {aberto && (
        <div className="linha-tempo">
          {historico === null ? (
            <p className="vazio" role="status">Carregando histórico…</p>
          ) : (
            <ol className="timeline" role="list">
              {historico.map((h) => (
                <li key={h.id} className="timeline-item">
                  <span className={`timeline-marca timeline-marca--${h.tipo}`} aria-hidden="true" />
                  <div>
                    <p className="timeline-texto">
                      {h.tipo === 'comentario'
                        ? h.texto
                        : h.status_anterior
                          ? `Status alterado de “${ROTULOS.status[h.status_anterior]}” para “${ROTULOS.status[h.status_novo]}”.`
                          : (h.texto || `Status definido como “${ROTULOS.status[h.status_novo]}”.`)}
                    </p>
                    <p className="timeline-meta">
                      {h.autor_nome || 'Sistema'} · {formatarData(h.criado_em)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}

          <form className="form-comentario" onSubmit={enviarComentario}>
            <label htmlFor={`comentario-${alerta.id}`} className="sr-only">
              Novo comentário
            </label>
            <textarea
              id={`comentario-${alerta.id}`}
              rows="2"
              placeholder="Adicionar um comentário…"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
            />
            <button type="submit" className="btn btn--pequeno btn--primario" disabled={enviando}>
              {enviando ? 'Enviando…' : 'Comentar'}
            </button>
          </form>
        </div>
      )}
    </li>
  );
}
