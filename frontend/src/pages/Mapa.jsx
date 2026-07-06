// Página do mapa geográfico das escolas (visão municipal / por escola).
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import MapaEscolas from '../components/MapaEscolas.jsx';

export default function Mapa() {
  const [escolas, setEscolas] = useState([]);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api
      .mapaRelatorio()
      .then(setEscolas)
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, []);

  return (
    <div className="painel area-relatorio">
      <div className="secao-cabecalho">
        <h2>Mapa das escolas</h2>
        <button className="btn nao-imprimir" onClick={() => window.print()}>
          Imprimir / PDF
        </button>
      </div>

      {erro && <p className="alerta-erro" role="alert">{erro}</p>}
      {carregando && <p className="vazio" role="status">Carregando…</p>}

      {!carregando && !erro && (
        escolas.length === 0
          ? <p className="vazio">Nenhuma escola cadastrada ainda.</p>
          : <MapaEscolas escolas={escolas} />
      )}
    </div>
  );
}
