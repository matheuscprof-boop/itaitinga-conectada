// Diário de Bordo — galeria de fotos do aluno (eixo C).
// Upload (multipart) com legenda e remoção. Recarrega via onAtualizar.
import { useState } from 'react';
import { api } from '../api.js';

export default function Logbook({ alunoId, fotos = [], podeEditar = true, onAtualizar }) {
  const [arquivo, setArquivo] = useState(null);
  const [legenda, setLegenda] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    if (!arquivo) { setErro('Escolha uma imagem.'); return; }
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append('foto', arquivo);
      if (legenda) fd.append('legenda', legenda);
      await api.enviarFotoLogbook(alunoId, fd);
      setArquivo(null);
      setLegenda('');
      e.target.reset?.();
      onAtualizar?.();
    } catch (err) { setErro(err.message); }
    finally { setEnviando(false); }
  }

  async function remover(id) {
    if (!confirm('Remover esta foto do diário?')) return;
    try {
      await api.removerFotoLogbook(id);
      onAtualizar?.();
    } catch (err) { setErro(err.message); }
  }

  return (
    <div className="logbook">
      <h3>Diário de Bordo</h3>
      {erro && <p className="alerta-erro" role="alert">{erro}</p>}

      {podeEditar && (
        <form className="form logbook-form" onSubmit={enviar}>
          <div className="campo">
            <label htmlFor="logbook-foto">Nova foto</label>
            <input id="logbook-foto" type="file" accept="image/*"
              onChange={(e) => setArquivo(e.target.files?.[0] || null)} />
          </div>
          <div className="campo">
            <label htmlFor="logbook-legenda">Legenda</label>
            <input id="logbook-legenda" value={legenda} onChange={(e) => setLegenda(e.target.value)} />
          </div>
          <button className="btn" type="submit" disabled={enviando}>
            {enviando ? 'Enviando…' : 'Adicionar ao diário'}
          </button>
        </form>
      )}

      {fotos.length === 0 ? (
        <p className="vazio">Nenhuma foto no diário ainda.</p>
      ) : (
        <ul className="logbook-galeria" role="list">
          {fotos.map((f) => (
            <li key={f.id}>
              <figure className="logbook-foto">
                <img src={f.arquivo} alt={f.legenda || 'Foto do diário de bordo'} loading="lazy" />
                {f.legenda && <figcaption>{f.legenda}</figcaption>}
                {podeEditar && (
                  <button className="logbook-foto__remover" aria-label="Remover foto"
                    onClick={() => remover(f.id)}>×</button>
                )}
              </figure>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
