// Feed de notificações da equipe de gestão (alertas de nível alto).
import { useEffect, useState } from 'react';
import { api } from '../api.js';

function formatarData(iso) {
  if (!iso) return '';
  return new Date(iso.replace(' ', 'T') + 'Z').toLocaleString('pt-BR');
}

export default function Notificacoes({ onMudou }) {
  const [notificacoes, setNotificacoes] = useState([]);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    setCarregando(true);
    try {
      const r = await api.listarNotificacoes();
      setNotificacoes(r.notificacoes);
      onMudou?.(r.nao_lidas);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function marcarLida(id) {
    await api.marcarNotificacaoLida(id);
    carregar();
  }

  async function marcarTodas() {
    await api.marcarTodasNotificacoesLidas();
    carregar();
  }

  const temNaoLidas = notificacoes.some((n) => !n.lida);

  return (
    <div className="painel">
      <div className="secao-cabecalho">
        <h2>Notificações</h2>
        {temNaoLidas && (
          <button className="btn" onClick={marcarTodas}>
            Marcar todas como lidas
          </button>
        )}
      </div>

      {erro && <p className="alerta-erro" role="alert">{erro}</p>}
      {carregando && <p className="vazio" role="status">Carregando…</p>}

      {!carregando && notificacoes.length === 0 && (
        <p className="vazio">Nenhuma notificação no momento.</p>
      )}

      <ul className="lista" role="list">
        {notificacoes.map((n) => (
          <li key={n.id} className={`card card--notificacao ${n.lida ? '' : 'nao-lida'}`}>
            <div className="notif-topo">
              <strong>{n.titulo}</strong>
              {!n.lida && <span className="ponto-nao-lida" aria-label="Não lida" />}
            </div>
            {n.mensagem && <p className="alerta-descricao">{n.mensagem}</p>}
            <div className="notif-rodape">
              <span className="timeline-meta">{formatarData(n.criado_em)}</span>
              {!n.lida && (
                <button className="btn btn--pequeno" onClick={() => marcarLida(n.id)}>
                  Marcar como lida
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
