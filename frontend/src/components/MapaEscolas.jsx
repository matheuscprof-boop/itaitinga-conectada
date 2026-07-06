// Mapa geográfico das escolas sobre o mapa real (Leaflet + OpenStreetMap),
// reutilizando o componente MapaLeaflet (o mesmo do Portal de Infraestrutura).
// Cada escola vira um marcador; o emoji indica a severidade dos alertas em
// aberto. Abaixo há uma tabela equivalente (acessível) com os números exatos.

import { useMemo } from 'react';
import MapaLeaflet from './MapaLeaflet.jsx';

function escaparHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Emoji por severidade: 🔴 tem alerta alto, 🟠 tem alerta aberto, 🏫 sem alerta.
function emojiSeveridade(e) {
  if (e.altos > 0) return '🔴';
  if (e.abertos > 0) return '🟠';
  return '🏫';
}

export default function MapaEscolas({ escolas }) {
  const lista = escolas || [];
  const comCoord = lista.filter((e) => e.latitude != null && e.longitude != null);
  const semCoord = lista.filter((e) => e.latitude == null || e.longitude == null);

  const marcadores = useMemo(
    () =>
      comCoord.map((e) => ({
        id: e.escola_id,
        latitude: e.latitude,
        longitude: e.longitude,
        emoji: emojiSeveridade(e),
        emojiLabel: e.nome,
        popup:
          `<strong>🏫 ${escaparHtml(e.nome)}</strong><br/>` +
          `${escaparHtml(e.municipio || '—')}<br/>` +
          `<em>${e.abertos} aberto(s) · ${e.altos} alto(s) · ${e.total} no total</em>`,
      })),
    [comCoord]
  );

  return (
    <div className="mapa">
      {comCoord.length === 0 ? (
        <p className="vazio">Nenhuma escola com coordenadas cadastradas.</p>
      ) : (
        <MapaLeaflet marcadores={marcadores} altura={420} />
      )}

      {/* Legenda */}
      <ul className="mapa-legenda" role="list">
        <li><span aria-hidden="true">🔴</span> Com alerta alto</li>
        <li><span aria-hidden="true">🟠</span> Com alerta aberto</li>
        <li><span aria-hidden="true">🏫</span> Sem alerta aberto</li>
      </ul>

      {/* Tabela equivalente (acessível e com os números exatos) */}
      <div className="tabela-scroll">
      <table className="tabela">
        <thead>
          <tr>
            <th scope="col">Escola</th>
            <th scope="col">Município</th>
            <th scope="col">Abertos</th>
            <th scope="col">Altos</th>
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {[...comCoord, ...semCoord].map((e) => (
            <tr key={e.escola_id}>
              <td>{e.nome}</td>
              <td>{e.municipio || '—'}</td>
              <td>{e.abertos}</td>
              <td>{e.altos}</td>
              <td>{e.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {semCoord.length > 0 && (
        <p className="vazio">
          {semCoord.length} escola(s) sem coordenadas não aparecem no mapa (cadastre latitude/longitude).
        </p>
      )}
    </div>
  );
}
