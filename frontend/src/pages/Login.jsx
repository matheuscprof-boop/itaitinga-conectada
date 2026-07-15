// Tela de login. Ao autenticar, chama onLogin(usuario).
import { useState } from 'react';
import { api } from '../api.js';

export default function Login({ onLogin, onCadastrar, onPortal, onPrecisaVerificar }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [naoVerificado, setNaoVerificado] = useState(null); // e-mail a confirmar
  const [entrando, setEntrando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setNaoVerificado(null);
    setEntrando(true);
    try {
      const usuario = await api.login(email, senha);
      onLogin(usuario);
    } catch (err) {
      setErro(err.message);
      // E-mail ainda não confirmado: oferece ir para a tela de código.
      if (err.motivo === 'email_nao_verificado') {
        setNaoVerificado(err.email || email);
      }
    } finally {
      setEntrando(false);
    }
  }

  return (
    <div className="tela-login">
      <aside className="login-arte">
        <video
          className="login-video"
          src="/marca/logo-animada.mp4"
          autoPlay
          muted
          playsInline
          aria-hidden="true"
        />
        <div className="login-arte__conteudo">
          <div className="login-arte__logo">
            <img src="/marca/logo-branco.svg" alt="Itaitinga Conectada" />
          </div>
          <p className="login-arte__slogan">
            Inovação maker para a cidadania integral — educação, saúde e cidadania de Itaitinga em um só lugar.
          </p>
        </div>
      </aside>

      <div className="login-form-lado">
      <form className="card form form-login" onSubmit={enviar} aria-labelledby="titulo-login">
        <h1 id="titulo-login">Entrar no Itaitinga Conectada</h1>
        <p className="subtitulo-login">Acompanhamento estudantil e cidadania em Itaitinga</p>

        {erro && (
          <p className="alerta-erro" role="alert">
            {erro}
          </p>
        )}

        {naoVerificado && onPrecisaVerificar && (
          <button
            type="button"
            className="btn"
            onClick={() => onPrecisaVerificar(naoVerificado)}
          >
            Confirmar e-mail agora
          </button>
        )}

        <div className="campo">
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="campo">
          <label htmlFor="senha">Senha</label>
          <input
            id="senha"
            type="password"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </div>

        <button type="submit" className="btn btn--primario" disabled={entrando}>
          {entrando ? 'Entrando…' : 'Entrar'}
        </button>

        <p className="dica-login">
          Acesso inicial: <strong>admin@saae.local</strong> / <strong>admin123</strong>
        </p>

        <div className="login-links">
          {onCadastrar && (
            <button type="button" className="link-voltar" onClick={onCadastrar}>
              Criar conta
            </button>
          )}
          {onPortal && (
            <button type="button" className="link-voltar" onClick={onPortal}>
              Ver alertas de infraestrutura
            </button>
          )}
        </div>
      </form>
      </div>
    </div>
  );
}
