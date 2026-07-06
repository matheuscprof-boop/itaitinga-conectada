// Acesso à geolocalização do dispositivo (API do navegador).
// Sempre pede permissão ao usuário — nunca é silencioso. Devolve { lat, lng }.

export function obterLocalizacao(opcoes = {}) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocalização não é suportada neste navegador.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) =>
        reject(
          new Error(
            err && err.code === 1
              ? 'Permissão de localização negada. Você pode marcar o ponto no mapa manualmente.'
              : 'Não foi possível obter sua localização. Marque o ponto no mapa.'
          )
        ),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0, ...opcoes }
    );
  });
}
