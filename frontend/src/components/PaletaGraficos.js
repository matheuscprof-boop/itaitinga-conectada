// Paleta de cores compartilhada pelos gráficos, com bom contraste.
export const PALETA = [
  '#1f5fbf', // azul
  '#b8860b', // âmbar
  '#1b7f5a', // verde
  '#b3261e', // vermelho
  '#7c3aed', // roxo
  '#0e7490', // ciano
  '#c2410c', // laranja
  '#4d5567', // cinza-azulado
];

export function corPorIndice(i) {
  return PALETA[i % PALETA.length];
}
