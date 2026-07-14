// Menu suspenso (dropdown) para agrupar itens do cabeçalho e reduzir a
// poluição da navegação. Acessível: aria-haspopup/expanded, fecha ao clicar
// fora ou com Esc. Os itens são passados como children (botões).
import { useEffect, useRef, useState } from 'react';

export default function MenuSuspenso({ rotulo, ativo = false, children }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!aberto) return undefined;
    function aoClicarFora(e) {
      if (ref.current && !ref.current.contains(e.target)) setAberto(false);
    }
    function aoTeclar(e) {
      if (e.key === 'Escape') setAberto(false);
    }
    document.addEventListener('mousedown', aoClicarFora);
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('mousedown', aoClicarFora);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [aberto]);

  return (
    <div className="menu-suspenso" ref={ref}>
      <button
        type="button"
        className={`nav-item ${ativo ? 'nav-item--ativo' : ''}`}
        aria-haspopup="true"
        aria-expanded={aberto}
        onClick={() => setAberto((a) => !a)}
      >
        {rotulo} <span aria-hidden="true" className="menu-suspenso__seta">▾</span>
      </button>
      {aberto && (
        <div className="menu-suspenso__lista" role="menu" onClick={() => setAberto(false)}>
          {children}
        </div>
      )}
    </div>
  );
}
