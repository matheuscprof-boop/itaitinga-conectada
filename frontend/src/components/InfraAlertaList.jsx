// Lista de alertas de infraestrutura, agrupada por status (Aberto / Em andamento
// / Resolvido) com um resumo de contagens no topo. Cada cartão traz foto,
// categoria, autoria (ou "Anônimo") e bairro. Para a Secretaria, permite alterar
// o status.
import { ROTULOS } from '../api.js';
import EstadoVazio from './EstadoVazio.jsx';

const STATUS_INFRA = ['aberto', 'em_andamento', 'resolvido'];

export default function InfraAlertaList({ alertas, podeGerenciarStatus = false, onAtualizarStatus }) {
  if (!alertas || alertas.length === 0) {
    return (
      <EstadoVazio icone="🛠️" titulo="Nenhum alerta registrado ainda">
        Os relatos de infraestrutura da população aparecem aqui.
      </EstadoVazio>
    );
  }

  // Conta por status para o resumo (respeita o filtro atual, pois `alertas` já
  // vem filtrado da página).
  const contagem = Object.fromEntries(STATUS_INFRA.map((s) => [s, 0]));
  for (const a of alertas) if (a.status in contagem) contagem[a.status] += 1;

  return (
    <div className="infra-agrupado">
      <ul className="infra-resumo" role="list" aria-label="Resumo por situação">
        {STATUS_INFRA.map((s) => (
          <li key={s} className={`infra-resumo__item infra-resumo__item--${s}`}>
            <strong>{contagem[s]}</strong>
            <span>{ROTULOS.status[s]}</span>
          </li>
        ))}
      </ul>

      {STATUS_INFRA.map((s) => {
        const doStatus = alertas.filter((a) => a.status === s);
        if (doStatus.length === 0) return null;
        return (
          <section key={s} className="infra-grupo" aria-labelledby={`infra-grupo-${s}`}>
            <h3 id={`infra-grupo-${s}`} className="infra-grupo__titulo">
              <span className={`badge badge--status-${s}`}>{ROTULOS.status[s]}</span>
              <span className="infra-grupo__contagem">{doStatus.length}</span>
            </h3>
            <ul className="infra-lista" role="list">
              {doStatus.map((a) => (
                <InfraCard
                  key={a.id}
                  alerta={a}
                  podeGerenciarStatus={podeGerenciarStatus}
                  onAtualizarStatus={onAtualizarStatus}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function InfraCard({ alerta: a, podeGerenciarStatus, onAtualizarStatus }) {
  return (
    <li className="card infra-card">
      {a.foto && (
        <img
          className="infra-card__foto"
          src={a.foto}
          alt={`Foto do alerta de ${ROTULOS.categoriaInfra[a.categoria] || a.categoria}`}
          loading="lazy"
        />
      )}
      <div className="infra-card__corpo">
        <div className="infra-card__topo">
          <span className={`badge badge--cat-${a.categoria}`}>
            {ROTULOS.categoriaInfra[a.categoria] || a.categoria}
          </span>
          <span className={`badge badge--status-${a.status}`}>
            {ROTULOS.status[a.status] || a.status}
          </span>
        </div>
        <p className="infra-card__descricao">{a.descricao}</p>
        <p className="infra-card__meta">
          {a.anonimo ? 'Anônimo' : a.autor_nome || '—'}
          {a.bairro && <span> · 📍 {a.bairro}</span>}
        </p>

        {podeGerenciarStatus && (
          <label className="infra-card__status-editor">
            <span>Alterar status:</span>
            <select
              value={a.status}
              onChange={(e) => onAtualizarStatus?.(a.id, e.target.value)}
            >
              {STATUS_INFRA.map((s) => (
                <option key={s} value={s}>
                  {ROTULOS.status[s]}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </li>
  );
}
