// Bloco de filtros reutilizável (Relatórios e Painel Analítico).
// Controlado pelo pai: recebe os valores e notifica alterações.
import { ROTULOS } from '../api.js';

const EIXOS = ['frequencia', 'desempenho', 'socioemocional'];
const NIVEIS = ['baixo', 'medio', 'alto'];
const STATUS = ['aberto', 'em_andamento', 'resolvido'];

export const FILTROS_VAZIOS = { escola_id: '', turma: '', eixo: '', nivel: '', status: '', de: '', ate: '' };

// `escolas` só é passado para a Secretaria (filtro por escola).
export default function FiltrosAlertas({ filtros, turmas, escolas, onAlterar, onLimpar }) {
  return (
    <form className="card filtros nao-imprimir" aria-label="Filtros">
      <div className="form-grid">
        {escolas?.length > 0 && (
          <div className="campo">
            <label htmlFor="f-escola">Escola</label>
            <select id="f-escola" value={filtros.escola_id} onChange={(e) => onAlterar('escola_id', e.target.value)}>
              <option value="">Todas</option>
              {escolas.map((e) => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>
          </div>
        )}

        <div className="campo">
          <label htmlFor="f-turma">Turma</label>
          <select id="f-turma" value={filtros.turma} onChange={(e) => onAlterar('turma', e.target.value)}>
            <option value="">Todas</option>
            {turmas.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="campo">
          <label htmlFor="f-eixo">Eixo</label>
          <select id="f-eixo" value={filtros.eixo} onChange={(e) => onAlterar('eixo', e.target.value)}>
            <option value="">Todos</option>
            {EIXOS.map((v) => (
              <option key={v} value={v}>{ROTULOS.eixo[v]}</option>
            ))}
          </select>
        </div>

        <div className="campo">
          <label htmlFor="f-nivel">Nível</label>
          <select id="f-nivel" value={filtros.nivel} onChange={(e) => onAlterar('nivel', e.target.value)}>
            <option value="">Todos</option>
            {NIVEIS.map((v) => (
              <option key={v} value={v}>{ROTULOS.nivel[v]}</option>
            ))}
          </select>
        </div>

        <div className="campo">
          <label htmlFor="f-status">Status</label>
          <select id="f-status" value={filtros.status} onChange={(e) => onAlterar('status', e.target.value)}>
            <option value="">Todos</option>
            {STATUS.map((v) => (
              <option key={v} value={v}>{ROTULOS.status[v]}</option>
            ))}
          </select>
        </div>

        <div className="campo">
          <label htmlFor="f-de">De</label>
          <input id="f-de" type="date" value={filtros.de} onChange={(e) => onAlterar('de', e.target.value)} />
        </div>

        <div className="campo">
          <label htmlFor="f-ate">Até</label>
          <input id="f-ate" type="date" value={filtros.ate} onChange={(e) => onAlterar('ate', e.target.value)} />
        </div>
      </div>

      <div className="form-acoes">
        <button type="button" className="btn" onClick={onLimpar}>
          Limpar filtros
        </button>
      </div>
    </form>
  );
}
