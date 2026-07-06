// Lista de alertas de infraestrutura em cartões, com foto, categoria, status e
// autoria (ou "Anônimo"). Para a Secretaria, permite alterar o status.
import { ROTULOS } from '../api.js';

const STATUS_INFRA = ['aberto', 'em_andamento', 'resolvido'];

export default function InfraAlertaList({ alertas, podeGerenciarStatus = false, onAtualizarStatus }) {
  if (!alertas || alertas.length === 0) {
    return <p className="vazio">Nenhum alerta registrado ainda.</p>;
  }

  return (
    <ul className="infra-lista" role="list">
      {alertas.map((a) => (
        <li key={a.id} className="card infra-card">
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
              {a.latitude != null && a.longitude != null && (
                <span> · {Number(a.latitude).toFixed(4)}, {Number(a.longitude).toFixed(4)}</span>
              )}
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
      ))}
    </ul>
  );
}
