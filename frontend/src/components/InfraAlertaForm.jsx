// Formulário do cidadão para registrar um alerta de infraestrutura.
// Envia FormData (multipart) para suportar a foto opcional.
import { useEffect, useState } from 'react';
import { api, ROTULOS, rotuloInfra } from '../api.js';
import { obterLocalizacao } from '../geo.js';
import MapaLeaflet from './MapaLeaflet.jsx';

const CATEGORIAS = Object.keys(ROTULOS.categoriaInfra);

export default function InfraAlertaForm({ onCriar }) {
  const [categoria, setCategoria] = useState('buraco');
  const [descricao, setDescricao] = useState('');
  const [bairro, setBairro] = useState('');
  const [bairrosSugeridos, setBairrosSugeridos] = useState([]);
  const [foto, setFoto] = useState(null);

  // Carrega os bairros já usados (sugestões do campo de bairro).
  useEffect(() => {
    api.infraListarBairros().then(setBairrosSugeridos).catch(() => {});
  }, []);
  const [previewFoto, setPreviewFoto] = useState(null);
  const [ponto, setPonto] = useState(null); // { lat, lng }
  const [anonimo, setAnonimo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('');
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');

  async function usarMinhaLocalizacao() {
    setGpsStatus('Obtendo sua localização…');
    try {
      const p = await obterLocalizacao();
      setPonto(p);
      setGpsStatus('Localização preenchida a partir do seu dispositivo.');
    } catch (e) {
      setGpsStatus(e.message);
    }
  }

  function escolherFoto(e) {
    const arquivo = e.target.files?.[0] || null;
    setFoto(arquivo);
    setPreviewFoto(arquivo ? URL.createObjectURL(arquivo) : null);
  }

  function definirPonto(lat, lng) {
    setPonto({ lat, lng });
  }

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setOk('');
    if (!descricao.trim()) {
      setErro('Descreva o problema.');
      return;
    }
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append('categoria', categoria);
      fd.append('descricao', descricao.trim());
      if (bairro.trim()) fd.append('bairro', bairro.trim());
      fd.append('anonimo', anonimo ? '1' : '0');
      if (ponto) {
        fd.append('latitude', String(ponto.lat));
        fd.append('longitude', String(ponto.lng));
      }
      if (foto) fd.append('foto', foto);

      await onCriar(fd);
      setOk('Alerta registrado. Obrigado por contribuir com Itaitinga!');
      setDescricao('');
      setBairro('');
      setFoto(null);
      setPreviewFoto(null);
      setPonto(null);
      setAnonimo(false);
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="card form infra-form" onSubmit={enviar} aria-labelledby="titulo-infra-form">
      <h2 id="titulo-infra-form">Registrar um alerta</h2>

      {erro && <p className="alerta-erro" role="alert">{erro}</p>}
      {ok && <p className="alerta-sucesso" role="status">{ok}</p>}

      <div className="campo">
        <label htmlFor="categoria">Categoria do problema</label>
        <select id="categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>{rotuloInfra(c)}</option>
          ))}
        </select>
      </div>

      <div className="campo">
        <label htmlFor="descricao">Descrição</label>
        <textarea
          id="descricao"
          rows={4}
          required
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Descreva o problema e o ponto de referência."
        />
      </div>

      <div className="campo">
        <label htmlFor="bairro">Bairro (opcional)</label>
        <input
          id="bairro"
          type="text"
          list="lista-bairros"
          value={bairro}
          onChange={(e) => setBairro(e.target.value)}
          placeholder="ex.: Centro, Gereraú…"
        />
        <datalist id="lista-bairros">
          {bairrosSugeridos.map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>
      </div>

      <div className="campo">
        <label htmlFor="foto">Foto (opcional)</label>
        <input id="foto" type="file" accept="image/*" onChange={escolherFoto} />
        {previewFoto && (
          <img src={previewFoto} alt="Pré-visualização da foto escolhida" className="infra-form__preview" />
        )}
      </div>

      <div className="campo">
        <label id="rotulo-local">Localização (clique no mapa ou use seu GPS)</label>
        <button type="button" className="btn btn-gps" onClick={usarMinhaLocalizacao}>
          📍 Usar minha localização
        </button>
        {gpsStatus && <p className="gps-status" role="status">{gpsStatus}</p>}
        <div aria-labelledby="rotulo-local">
          <MapaLeaflet modoPicker onEscolher={definirPonto} pontoSelecionado={ponto} altura={280} />
        </div>
        <div className="infra-form__coords">
          <label>
            Latitude
            <input
              type="number" step="any" value={ponto?.lat ?? ''}
              onChange={(e) => setPonto((p) => ({ lat: Number(e.target.value), lng: p?.lng ?? 0 }))}
            />
          </label>
          <label>
            Longitude
            <input
              type="number" step="any" value={ponto?.lng ?? ''}
              onChange={(e) => setPonto((p) => ({ lat: p?.lat ?? 0, lng: Number(e.target.value) }))}
            />
          </label>
        </div>
      </div>

      <label className="campo-checkbox">
        <input type="checkbox" checked={anonimo} onChange={(e) => setAnonimo(e.target.checked)} />
        <span>Enviar de forma anônima (não vincular meu nome ao alerta)</span>
      </label>

      <button type="submit" className="btn btn--primario" disabled={enviando}>
        {enviando ? 'Enviando…' : 'Registrar alerta'}
      </button>
    </form>
  );
}
