// Campo de senha com botão "olhinho" para mostrar/ocultar o que é digitado.
// Reutilizado no login, cadastro e troca de senha.
import { useState } from 'react';

export default function CampoSenha({
  id,
  label,
  value,
  onChange,
  autoComplete = 'current-password',
  required = false,
  minLength,
  dica,
}) {
  const [visivel, setVisivel] = useState(false);

  return (
    <div className="campo">
      <label htmlFor={id}>{label}</label>
      <div className="campo-senha">
        <input
          id={id}
          type={visivel ? 'text' : 'password'}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          value={value}
          onChange={onChange}
        />
        <button
          type="button"
          className="campo-senha__olho"
          onClick={() => setVisivel((v) => !v)}
          aria-pressed={visivel}
          aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
          title={visivel ? 'Ocultar senha' : 'Mostrar senha'}
        >
          <span aria-hidden="true">{visivel ? '🙈' : '👁️'}</span>
        </button>
      </div>
      {dica && <p className="dica-campo">{dica}</p>}
    </div>
  );
}
