// Denúncia rápida com 1 clique: o cidadão escolhe a categoria e o alerta é
// registrado usando a localização automática do dispositivo (com permissão).
// A descrição é opcional (o backend usa o rótulo da categoria).
import { useState } from 'react';
import { ROTULOS, EMOJI_INFRA } from '../api.js';
import { obterLocalizacao } from '../geo.js';

const CATEGORIAS = Object.keys(ROTULOS.categoriaInfra);

export default function RelatoRapido({ onCriar }) {
  const [status, setStatus] = useState('');
  const [enviando, setEnviando] = useState('');
  const [erro, setErro] = useState(false);

  async function relatar(categoria) {
    setErro(false);
    setEnviando(categoria);
    setStatus('Obtendo sua localização…');
    try {
      const p = await obterLocalizacao();
      const fd = new FormData();
      fd.append('categoria', categoria);
      fd.append('latitude', String(p.lat));
      fd.append('longitude', String(p.lng));
      await onCriar(fd);
      setStatus(`Alerta de "${ROTULOS.categoriaInfra[categoria]}" registrado na sua localização atual. Obrigado!`);
    } catch (e) {
      setErro(true);
      setStatus(e.message);
    } finally {
      setEnviando('');
    }
  }

  return (
    <section className="card relato-rapido" aria-labelledby="titulo-relato-rapido">
      <h2 id="titulo-relato-rapido">Denúncia rápida (1 clique)</h2>
      <p>
        Escolha a categoria: usamos a localização do seu dispositivo (com sua
        permissão) e registramos o alerta na hora. Para detalhes/foto, use o
        formulário completo abaixo.
      </p>
      <div className="relato-rapido__botoes">
        {CATEGORIAS.map((c) => (
          <button
            key={c}
            className="btn btn-gps"
            disabled={!!enviando}
            onClick={() => relatar(c)}
          >
            <span aria-hidden="true">{EMOJI_INFRA[c]}</span>{' '}
            {enviando === c ? 'Enviando…' : ROTULOS.categoriaInfra[c]}
          </button>
        ))}
      </div>
      {status && (
        <p className={`gps-status ${erro ? 'alerta-erro' : ''}`} role="status">
          {status}
        </p>
      )}
    </section>
  );
}
