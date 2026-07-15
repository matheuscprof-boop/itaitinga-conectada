// Gestão de escolas (acesso restrito à Secretaria Municipal).
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { obterLocalizacao } from '../geo.js';
import MapaLeaflet from '../components/MapaLeaflet.jsx';
import EstadoVazio from '../components/EstadoVazio.jsx';

const FORM_VAZIO = { nome: '', municipio: '', endereco: '', latitude: '', longitude: '' };

export default function Escolas() {
  const [escolas, setEscolas] = useState([]);
  const [form, setForm] = useState(FORM_VAZIO);
  const [editandoId, setEditandoId] = useState(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [buscando, setBuscando] = useState(false);

  const editando = editandoId !== null;

  const ponto = form.latitude !== '' && form.longitude !== '' && form.latitude != null && form.longitude != null
    ? { lat: Number(form.latitude), lng: Number(form.longitude) }
    : null;

  function definirPonto(lat, lng) {
    setForm((f) => ({ ...f, latitude: lat, longitude: lng }));
  }

  // Endereço → coordenadas (geocodificação no backend).
  async function localizarEndereco() {
    const endereco = (form.endereco || '').trim();
    if (!endereco) { setErro('Digite o endereço da escola antes de localizar.'); return; }
    setErro(''); setAviso(''); setBuscando(true);
    try {
      const r = await api.geocodificar(endereco);
      setForm((f) => ({ ...f, latitude: r.latitude, longitude: r.longitude }));
      setAviso(`Endereço localizado: ${r.endereco_encontrado}. Confira o ponto no mapa e salve.`);
    } catch (e) {
      setErro(e.message);
    } finally {
      setBuscando(false);
    }
  }

  async function usarGps() {
    setErro(''); setAviso('');
    try {
      const { lat, lng } = await obterLocalizacao();
      setForm((f) => ({ ...f, latitude: lat, longitude: lng }));
      setAviso('Localização do dispositivo aplicada. Ajuste no mapa se necessário e salve.');
    } catch (e) {
      setErro(e.message);
    }
  }

  async function carregar() {
    try {
      setEscolas(await api.listarEscolas());
    } catch (e) {
      setErro(e.message);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  function alterar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  function iniciarEdicao(e) {
    setEditandoId(e.id);
    setForm({
      nome: e.nome, municipio: e.municipio || '', endereco: e.endereco || '',
      latitude: e.latitude ?? '', longitude: e.longitude ?? '',
    });
    setErro('');
    setAviso('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelar() {
    setEditandoId(null);
    setForm(FORM_VAZIO);
    setErro('');
  }

  async function salvar(ev) {
    ev.preventDefault();
    setErro('');
    setAviso('');
    setSalvando(true);
    try {
      if (editando) {
        await api.atualizarEscola(editandoId, form);
        setAviso(`Escola "${form.nome}" atualizada.`);
      } else {
        await api.criarEscola(form);
        setAviso(`Escola "${form.nome}" criada.`);
      }
      cancelar();
      carregar();
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function remover(escola) {
    if (!confirm(`Remover a escola "${escola.nome}"? Alunos e usuários ficarão sem escola.`)) return;
    setErro('');
    setAviso('');
    try {
      await api.removerEscola(escola.id);
      if (editandoId === escola.id) cancelar();
      carregar();
    } catch (err) {
      setErro(err.message);
    }
  }

  return (
    <div className="painel">
      <h2>Escolas</h2>

      {erro && <p className="alerta-erro" role="alert">{erro}</p>}
      {aviso && <p className="alerta-sucesso" role="status">{aviso}</p>}

      <form className="card form" onSubmit={salvar} aria-labelledby="titulo-form-escola">
        <h3 id="titulo-form-escola">{editando ? 'Editar escola' : 'Nova escola'}</h3>
        <div className="form-grid">
          <div className="campo">
            <label htmlFor="e-nome">Nome <span aria-hidden="true">*</span></label>
            <input id="e-nome" type="text" required value={form.nome}
              onChange={(e) => alterar('nome', e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="e-municipio">Município</label>
            <input id="e-municipio" type="text" value={form.municipio}
              onChange={(e) => alterar('municipio', e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="e-endereco">Endereço</label>
            <div className="geo-endereco">
              <input id="e-endereco" type="text" value={form.endereco}
                placeholder="Ex.: Av. Cruzeiro do Sul, 612 - Centro"
                onChange={(e) => alterar('endereco', e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); localizarEndereco(); } }} />
              <button type="button" className="btn btn--pequeno" onClick={localizarEndereco} disabled={buscando}>
                {buscando ? 'Localizando…' : 'Localizar endereço'}
              </button>
            </div>
          </div>
        </div>

        <fieldset className="campo geo-residencia">
          <legend>Localização no mapa</legend>
          <button type="button" className="btn btn--pequeno" onClick={usarGps}>
            📍 Usar minha localização (GPS)
          </button>
          <div className="campo">
            <label>Ponto no mapa (clique para ajustar)</label>
            <MapaLeaflet
              modoPicker
              onEscolher={definirPonto}
              pontoSelecionado={ponto}
              marcadores={ponto ? [{ id: 1, latitude: ponto.lat, longitude: ponto.lng, emoji: '🏫', emojiLabel: 'Escola' }] : []}
              altura={260}
            />
            <p className="local-status" aria-live="polite">
              {ponto ? '📍 Localização definida.' : 'Localização ainda não definida (a escola não aparece no mapa).'}
            </p>
          </div>
        </fieldset>

        <div className="form-acoes">
          <button type="submit" className="btn btn--primario" disabled={salvando}>
            {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Criar escola'}
          </button>
          {editando && (
            <button type="button" className="btn" onClick={cancelar}>Cancelar</button>
          )}
        </div>
      </form>

      <section aria-labelledby="titulo-lista-escolas">
        <h3 id="titulo-lista-escolas">Escolas cadastradas</h3>
        {escolas.length === 0 ? (
          <EstadoVazio icone="🏫" titulo="Nenhuma escola cadastrada">
            Cadastre uma escola no formulário acima.
          </EstadoVazio>
        ) : (
          <ul className="lista" role="list">
            {escolas.map((e) => (
              <li key={e.id} className="lista-item-info">
                <div>
                  <strong>{e.nome}</strong>
                  <span className="lista-item-sub">
                    {e.municipio || 'Município não informado'}
                    {e.latitude != null && e.longitude != null
                      ? ' · 📍 no mapa'
                      : ' · sem localização'}
                  </span>
                </div>
                <div className="usuario-acoes">
                  <button className="btn btn--pequeno" onClick={() => iniciarEdicao(e)}>Editar</button>
                  <button className="btn btn--pequeno btn--perigo" onClick={() => remover(e)}>Remover</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
