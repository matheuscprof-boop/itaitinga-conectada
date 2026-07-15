// Estado vazio ilustrado: ícone em círculo + título + dica opcional.
// Usado quando uma lista não tem itens, no lugar de um texto simples.
export default function EstadoVazio({ icone = '📭', titulo, children }) {
  return (
    <div className="estado-vazio" role="status">
      <span className="estado-vazio__ic" aria-hidden="true">{icone}</span>
      <p className="estado-vazio__titulo">{titulo}</p>
      {children && <p className="estado-vazio__sub">{children}</p>}
    </div>
  );
}
