// Portal de Infraestrutura e Cidadania (eixo D).
// Contextos:
//   - Público (sem usuário): vê o mapa + lista de alertas; é convidado a entrar.
//   - Cidadão: além de ver, registra novos alertas.
//   - Secretaria: vê e gerencia o status dos alertas.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ROTULOS, EMOJI_INFRA, ehCidadao, ehSecretaria } from '../api.js';
import MapaLeaflet from '../components/MapaLeaflet.jsx';
import InfraAlertaList from '../components/InfraAlertaList.jsx';
import InfraAlertaForm from '../components/InfraAlertaForm.jsx';
import RelatoRapido from '../components/RelatoRapido.jsx';

const CATEGORIAS = Object.keys(ROTULOS.categoriaInfra);
const STATUS = ['aberto', 'em_andamento', 'resolvido'];

function escaparHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export default function PortalCidadao({ usuario = null, onEntrar, onCadastrar }) {
  const [alertas, setAlertas] = useState([]);
  const [filtros, setFiltros] = useState({ categoria: '', status: '', bairro: '' });
  const [bairros, setBairros] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const cidadao = usuario && ehCidadao(usuario.perfil);
  const secretaria = usuario && ehSecretaria(usuario.perfil);

  const carregar = useCallback(() => {
    setCarregando(true);
    api
      .infraListarAlertas(filtros)
      .then(setAlertas)
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [filtros]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Carrega a lista de bairros (para o filtro). Recarrega quando a lista de
  // alertas muda, pois um novo alerta pode introduzir um bairro inédito.
  useEffect(() => {
    api.infraListarBairros().then(setBairros).catch(() => {});
  }, [alertas]);

  const marcadores = useMemo(
    () =>
      alertas.map((a) => ({
        id: a.id,
        latitude: a.latitude,
        longitude: a.longitude,
        emoji: EMOJI_INFRA[a.categoria] || EMOJI_INFRA.outro,
        emojiLabel: ROTULOS.categoriaInfra[a.categoria] || a.categoria,
        popup:
          `<strong>${EMOJI_INFRA[a.categoria] || ''} ${escaparHtml(ROTULOS.categoriaInfra[a.categoria] || a.categoria)}</strong><br/>` +
          `${escaparHtml(a.descricao)}<br/>` +
          `<em>${escaparHtml(ROTULOS.status[a.status] || a.status)}</em> · ` +
          `${a.anonimo ? 'Anônimo' : escaparHtml(a.autor_nome || '—')}` +
          (a.foto ? `<br/><img src="${escaparHtml(a.foto)}" alt="" style="max-width:180px;margin-top:6px;border-radius:6px"/>` : ''),
      })),
    [alertas]
  );

  async function criarAlerta(formData) {
    await api.infraCriarAlerta(formData);
    carregar();
  }

  async function atualizarStatus(id, status) {
    try {
      await api.infraAtualizarStatus(id, status);
      carregar();
    } catch (e) {
      setErro(e.message);
    }
  }

  return (
    <section className="portal-cidadao">
      <header className="portal-cabecalho">
        <h1>Infraestrutura e Cidadania</h1>
        <p className="subtitulo">
          Problemas de infraestrutura em Itaitinga relatados pela população.
        </p>
      </header>

      {!usuario && (
        <div className="card aviso-publico">
          <p>
            Você está vendo os alertas públicos. Para <strong>registrar</strong> um novo alerta,
            entre como cidadão ou crie sua conta.
          </p>
          <div className="acoes">
            {onEntrar && <button className="btn btn--primario" onClick={onEntrar}>Entrar</button>}
            {onCadastrar && <button className="btn" onClick={onCadastrar}>Criar conta</button>}
          </div>
        </div>
      )}

      {cidadao && <RelatoRapido onCriar={criarAlerta} />}
      {cidadao && <InfraAlertaForm onCriar={criarAlerta} />}

      <div className="card">
        <MapaLeaflet marcadores={marcadores} altura={380} />
        <ul className="legenda-mapa" aria-label="Legenda de categorias">
          {CATEGORIAS.map((c) => (
            <li key={c}>
              <span className="legenda-emoji" aria-hidden="true">{EMOJI_INFRA[c]}</span>
              {ROTULOS.categoriaInfra[c]}
            </li>
          ))}
        </ul>
      </div>

      <div className="filtros-infra card">
        <label>
          Categoria
          <select
            value={filtros.categoria}
            onChange={(e) => setFiltros((f) => ({ ...f, categoria: e.target.value }))}
          >
            <option value="">Todas</option>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>{ROTULOS.categoriaInfra[c]}</option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select
            value={filtros.status}
            onChange={(e) => setFiltros((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="">Todos</option>
            {STATUS.map((s) => (
              <option key={s} value={s}>{ROTULOS.status[s]}</option>
            ))}
          </select>
        </label>
        <label>
          Bairro
          <select
            value={filtros.bairro}
            onChange={(e) => setFiltros((f) => ({ ...f, bairro: e.target.value }))}
          >
            <option value="">Todos</option>
            {bairros.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </label>
      </div>

      {erro && <p className="alerta-erro" role="alert">{erro}</p>}
      {carregando ? (
        <p className="vazio" role="status">Carregando alertas…</p>
      ) : (
        <InfraAlertaList
          alertas={alertas}
          podeGerenciarStatus={secretaria}
          onAtualizarStatus={atualizarStatus}
        />
      )}
    </section>
  );
}
