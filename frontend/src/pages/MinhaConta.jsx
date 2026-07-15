// Página "Minha conta": exibe os dados do usuário logado e permite trocar
// a própria senha.
import { useState } from 'react';
import { api, ROTULOS } from '../api.js';
import CampoSenha from '../components/CampoSenha.jsx';

export default function MinhaConta({ usuario }) {
  const [form, setForm] = useState({ senha_atual: '', nova_senha: '', confirmar: '' });
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [salvando, setSalvando] = useState(false);

  function alterar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setAviso('');
    if (form.nova_senha !== form.confirmar) {
      setErro('A confirmação não confere com a nova senha.');
      return;
    }
    setSalvando(true);
    try {
      await api.trocarSenha(form.senha_atual, form.nova_senha);
      setAviso('Senha alterada com sucesso.');
      setForm({ senha_atual: '', nova_senha: '', confirmar: '' });
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="painel">
      <h2>Minha conta</h2>

      <article className="card card--info">
        <dl className="lista-descricao">
          <div><dt>Nome</dt><dd>{usuario.nome}</dd></div>
          <div><dt>E-mail</dt><dd>{usuario.email}</dd></div>
          <div><dt>Perfil</dt><dd>{ROTULOS.perfil[usuario.perfil]}</dd></div>
        </dl>
      </article>

      <form className="card form" onSubmit={enviar} aria-labelledby="titulo-trocar-senha">
        <h3 id="titulo-trocar-senha">Trocar senha</h3>

        {erro && <p className="alerta-erro" role="alert">{erro}</p>}
        {aviso && <p className="alerta-sucesso" role="status">{aviso}</p>}

        <CampoSenha
          id="senha-atual"
          label="Senha atual"
          autoComplete="current-password"
          required
          value={form.senha_atual}
          onChange={(e) => alterar('senha_atual', e.target.value)}
        />
        <CampoSenha
          id="nova-senha"
          label="Nova senha (mín. 6 caracteres)"
          autoComplete="new-password"
          required
          minLength={6}
          value={form.nova_senha}
          onChange={(e) => alterar('nova_senha', e.target.value)}
        />
        <CampoSenha
          id="confirmar-senha"
          label="Confirmar nova senha"
          autoComplete="new-password"
          required
          minLength={6}
          value={form.confirmar}
          onChange={(e) => alterar('confirmar', e.target.value)}
        />

        <div className="form-acoes">
          <button type="submit" className="btn btn--primario" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar nova senha'}
          </button>
        </div>
      </form>
    </div>
  );
}
