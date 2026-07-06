// Mapa interativo reutilizável (Leaflet + tiles OpenStreetMap).
// Dois modos:
//   - visualização: recebe `marcadores` e mostra popups.
//   - picker: `modoPicker` + `onEscolher(lat, lng)` — clique define o ponto.
// Os tiles do OSM exigem internet no navegador; sem rede, o mapa ainda
// funciona mostrando os marcadores sobre um fundo neutro.

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

// Corrige o caminho dos ícones padrão quando empacotado pelo Vite.
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

// Ícone com emoji (usado para diferenciar categorias no mapa). Cai no pino
// padrão quando o marcador não traz emoji.
function iconePara(m) {
  if (!m.emoji) return undefined;
  return L.divIcon({
    html: `<span class="marcador-emoji" role="img" aria-label="${m.emojiLabel || ''}">${m.emoji}</span>`,
    className: 'marcador-emoji-wrap',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -16],
  });
}

// Centro padrão: Itaitinga/CE.
const CENTRO_PADRAO = [-3.9700, -38.5250];

export default function MapaLeaflet({
  marcadores = [],
  centro = CENTRO_PADRAO,
  zoom = 13,
  altura = 360,
  modoPicker = false,
  pontoSelecionado = null,
  onEscolher,
}) {
  const elRef = useRef(null);
  const mapaRef = useRef(null);
  const camadaMarcadores = useRef(null);
  const marcadorPicker = useRef(null);

  // Inicializa o mapa uma única vez.
  useEffect(() => {
    if (mapaRef.current || !elRef.current) return;
    const mapa = L.map(elRef.current).setView(centro, zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(mapa);
    camadaMarcadores.current = L.layerGroup().addTo(mapa);
    mapaRef.current = mapa;

    return () => {
      mapa.remove();
      mapaRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Modo picker: registra o clique para escolher a coordenada.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !modoPicker) return;
    const aoClicar = (e) => onEscolher?.(e.latlng.lat, e.latlng.lng);
    mapa.on('click', aoClicar);
    return () => mapa.off('click', aoClicar);
  }, [modoPicker, onEscolher]);

  // Marcador do ponto selecionado (picker).
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;
    if (marcadorPicker.current) {
      marcadorPicker.current.remove();
      marcadorPicker.current = null;
    }
    if (pontoSelecionado && pontoSelecionado.lat != null && pontoSelecionado.lng != null) {
      marcadorPicker.current = L.marker([pontoSelecionado.lat, pontoSelecionado.lng]).addTo(mapa);
    }
  }, [pontoSelecionado]);

  // Marcadores de visualização.
  useEffect(() => {
    const camada = camadaMarcadores.current;
    if (!camada) return;
    camada.clearLayers();
    const comCoord = marcadores.filter((m) => m.latitude != null && m.longitude != null);
    for (const m of comCoord) {
      const icone = iconePara(m);
      const marker = L.marker([m.latitude, m.longitude], icone ? { icon: icone } : undefined);
      if (m.popup) marker.bindPopup(m.popup);
      camada.addLayer(marker);
    }
    // Ajusta o enquadramento aos marcadores, se houver mais de um.
    const mapa = mapaRef.current;
    if (mapa && comCoord.length > 1) {
      const bounds = L.latLngBounds(comCoord.map((m) => [m.latitude, m.longitude]));
      mapa.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    } else if (mapa && comCoord.length === 1) {
      mapa.setView([comCoord[0].latitude, comCoord[0].longitude], 15);
    }
  }, [marcadores]);

  return (
    <div
      ref={elRef}
      className="mapa-leaflet"
      style={{ height: altura, width: '100%', borderRadius: 12 }}
      role="application"
      aria-label={modoPicker ? 'Mapa para escolher a localização do alerta' : 'Mapa dos alertas'}
    />
  );
}
