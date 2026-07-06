// Confirmação de e-mail por código. Usada após o cadastro e também quando
// alguém tenta entrar com o e-mail ainda não verificado.
import { useState } from 'react';
import { api } from '../api.js';

export default function VerificarEmail({ email, onVerificado, onVoltar }) {
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [concluido, setConcluido] = useState(null); // { mensagem }
  const [enviando, setEnviando] = useState(false);
  const [reenviando, setReenviando] = useState(false);

  async function confirmar(e) {
    e.preventDefault();
    setErro('');
    setAviso('');
    setEnviando(true);
    try {
      const r = await api.verificarEmail(email, codigo.trim());
      setConcluido({
        mensagem:
          r.mensagem ||
          (r.pendente_aprovacao
            ? 'E-mail confirmado! Sua conta está aguardando aprovação.'
            : 'E-mail confirmado! Você já pode entrar.'),
      });
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (concluido) {
    return (
      <div className="tela-login">
        <div className="card form form-login">
          <h1>E-mail confirmado</h1>
          <p className="alerta-sucesso" role="status">{concluido.mensagem}</p>
          <button className="btn btn--primario" onClick={onVerificado}>Ir para o login</button>
        </div>
      </div>
    );
  }

  async function reenviar() {
    setErro('');
    setAviso('');
    setReenviando(true);
    try {
      const r = await api.reenviarCodigo(email);
      setAviso(r.mensagem || 'Enviamos um novo código.');
    } catch (err) {
      setErro(err.message);
    } finally {
      setReenviando(false);
    }
  }

  return (
    <div className="tela-login">
      <form className="card form form-login" onSubmit={confirmar} aria-labelledby="titulo-verificar">
        <h1 id="titulo-verificar">Confirmar e-mail</h1>
        <p className="subtitulo-login">
          Enviamos um código de 6 dígitos para <strong>{email}</strong>. Digite-o abaixo para
          ativar sua conta.
        </p>

        {erro && <p className="alerta-erro" role="alert">{erro}</p>}
        {aviso && <p className="alerta-sucesso" role="status">{aviso}</p>}

        <div className="campo">
          <label htmlFor="codigo">Código de verificação</label>
          <input
            id="codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            placeholder="000000"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
        </div>

        <button type="submit" className="btn btn--primario" disabled={enviando}>
          {enviando ? 'Confirmando…' : 'Confirmar'}
        </button>

        <div className="login-links">
          <button type="button" className="link-voltar" onClick={reenviar} disabled={reenviando}>
            {reenviando ? 'Reenviando…' : 'Reenviar código'}
          </button>
          <button type="button" className="link-voltar" onClick={onVoltar}>
            ← Voltar ao login
          </button>
        </div>
      </form>
    </div>
  );
}
