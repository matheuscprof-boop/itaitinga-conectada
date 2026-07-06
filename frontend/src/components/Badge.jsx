// Selo colorido reutilizável para eixo, nível de risco e status.
// A cor vem de classes CSS (badge--<tipo>-<valor>) para manter contraste
// acessível e consistência visual.
import { ROTULOS } from '../api.js';

export default function Badge({ tipo, valor }) {
  const rotulo = ROTULOS[tipo]?.[valor] ?? valor;
  return <span className={`badge badge--${tipo}-${valor}`}>{rotulo}</span>;
}
