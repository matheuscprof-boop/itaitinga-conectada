// Eixo B — Assistência Social do aluno: programas, composição familiar e
// geolocalização residencial (cruzada com as áreas de risco do município).
//
// A localização é definida por ENDEREÇO (geocodificado em latitude/longitude)
// ou pelo GPS do dispositivo — não se digita mais lat/long na mão. O mapa serve
// para conferir e, se preciso, ajustar o ponto com um clique.
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { obterLocalizacao } from '../geo.js';
import MapaLeaflet from './MapaLeaflet.jsx';

export default function AssistenciaAluno({ alunoId, podeEditar = true }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    api.obterAssistencia(alunoId).then(setDados).catch((e) => setErro(e.message));
  }, [alunoId]);

  function definirPonto(lat, lng) {
    setDados((d) => ({ ...d, latitude: lat, longitude: lng }));
  }

  // Endereço → latitude/longitude (via serviço de geocodificação no backend).
  async function localizarEndereco() {
    const endereco = (dados.endereco || '').trim();
    if (!endereco) {
      setErro('Digite o endereço da residência antes de localizar.');
      return;
    }
    setErro(''); setOk(''); setBuscando(true);
    try {
      const r = await api.geocodificar(endereco);
      setDados((d) => ({ ...d, latitude: r.latitude, longitude: r.longitude }));
      setOk(`Endereço localizado: ${r.endereco_encontrado}. Confira o ponto no mapa e salve.`);
    } catch (e) {
      setErro(e.message);
    } finally {
      setBuscando(false);
    }
  }

  // GPS do dispositivo (pede permissão ao usuário).
  async function usarGps() {
    setErro(''); setOk('');
    try {
      const { lat, lng } = await obterLocalizacao();
      setDados((d) => ({ ...d, latitude: lat, longitude: lng }));
      setOk('Localização do dispositivo aplicada. Ajuste no mapa se necessário e salve.');
    } catch (e) {
      setErro(e.message);
    }
  }

  async function salvar(e) {
    e.preventDefault();
    setErro(''); setOk('');
    try {
      const resp = await api.salvarAssistencia(alunoId, {
        bolsa_familia: dados.bolsa_familia ? 1 : 0,
        programas: dados.programas,
        composicao_familiar: dados.composicao_familiar,
        endereco: dados.endereco,
        latitude: dados.latitude,
        longitude: dados.longitude,
      });
      setDados(resp);
      setOk(resp.em_area_risco
        ? `Salvo. Atenção: residência em área de risco (${resp.area_risco_nome}).`
        : 'Dados de assistência salvos.');
    } catch (err) { setErro(err.message); }
  }

  if (!dados) return <p className="vazio" role="status">Carregando…</p>;

  const ponto = dados.latitude != null && dados.longitude != null
    ? { lat: dados.latitude, lng: dados.longitude } : null;
  const coord = (v) => (v == null || v === '' ? '—' : Number(v).toFixed(6));

  return (
    <div className="eixo-secao">
      {erro && <p className="alerta-erro" role="alert">{erro}</p>}
      {ok && <p className="alerta-sucesso" role="status">{ok}</p>}
      {dados.em_area_risco === 1 && (
        <p className="aviso-risco" role="status">Este aluno reside em área de risco mapeada pelo município.</p>
      )}

      <form className="card form" onSubmit={salvar}>
        <label className="campo-checkbox">
          <input type="checkbox" checked={!!dados.bolsa_familia} disabled={!podeEditar}
            onChange={(e) => setDados({ ...dados, bolsa_familia: e.target.checked ? 1 : 0 })} />
          <span>Beneficiário do Bolsa Família</span>
        </label>

        <div className="campo">
          <label htmlFor="programas">Outros programas de auxílio</label>
          <input id="programas" value={dados.programas || ''} disabled={!podeEditar}
            onChange={(e) => setDados({ ...dados, programas: e.target.value })} />
        </div>
        <div className="campo">
          <label htmlFor="composicao">Composição do núcleo familiar</label>
          <textarea id="composicao" rows={2} value={dados.composicao_familiar || ''} disabled={!podeEditar}
            onChange={(e) => setDados({ ...dados, composicao_familiar: e.target.value })} />
        </div>

        <fieldset className="campo geo-residencia">
          <legend>Localização da residência</legend>

          <div className="campo">
            <label htmlFor="endereco-res">Endereço (rua, número, bairro)</label>
            <div className="geo-endereco">
              <input
                id="endereco-res"
                value={dados.endereco || ''}
                disabled={!podeEditar}
                placeholder="Ex.: Rua das Acácias, 100 - Centro"
                onChange={(e) => setDados({ ...dados, endereco: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); localizarEndereco(); }
                }}
              />
              {podeEditar && (
                <button type="button" className="btn btn--pequeno" onClick={localizarEndereco} disabled={buscando}>
                  {buscando ? 'Localizando…' : 'Localizar endereço'}
                </button>
              )}
            </div>
            {podeEditar && (
              <p className="ajuda">
                Digite o endereço e clique em <strong>Localizar endereço</strong> para converter em
                coordenadas, ou use o GPS do aparelho. Depois confira/ajuste o ponto no mapa.
              </p>
            )}
          </div>

          {podeEditar && (
            <button type="button" className="btn btn--pequeno" onClick={usarGps}>
              📍 Usar minha localização (GPS)
            </button>
          )}

          <div className="campo">
            <label>Ponto no mapa {podeEditar && '(clique para ajustar)'}</label>
            <MapaLeaflet
              modoPicker={podeEditar}
              onEscolher={podeEditar ? definirPonto : undefined}
              pontoSelecionado={ponto}
              marcadores={ponto ? [{ id: 1, latitude: ponto.lat, longitude: ponto.lng, emoji: '🏠', emojiLabel: 'Residência' }] : []}
              altura={260}
            />
            <p className="coords-leitura" aria-live="polite">
              Coordenadas: <strong>{coord(dados.latitude)}</strong>, <strong>{coord(dados.longitude)}</strong>
              {ponto ? '' : ' — ainda não definidas'}
            </p>
          </div>
        </fieldset>

        {podeEditar && <button className="btn btn--primario" type="submit">Salvar assistência</button>}
      </form>
    </div>
  );
}
