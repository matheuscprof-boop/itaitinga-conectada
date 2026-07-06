// Autocadastro público. Cidadão entra imediatamente; equipe (professor/
// coordenação/direção) precisa selecionar uma escola e fica pendente de
// aprovação de um administrador.
import { useEffect, useState } from 'react';
import { api, ROTULOS } from '../api.js';

// Perfis oferecidos no autocadastro (Secretaria não se autocadastra).
const PERFIS = ['cidadao', 'professor', 'coordenacao', 'direcao'];

export default function Cadastro({ onVoltar }) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [perfil, setPerfil] = useState('cidadao');
  const [escolaId, setEscolaId] = useState('');
  const [escolas, setEscolas] = useState([]);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [enviando, setEnviando] = useState(false);

  const ehCidadao = perfil === 'cidadao';

  useEffect(() => {
    api.listarEscolasPublicas().then(setEscolas).catch(() => {});
  }, []);

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setSucesso('');
    if (senha.length < 6) {
      setErro('A senha deve ter ao menos 6 caracteres.');
      return;
    }
    if (!ehCidadao && !escolaId) {
      setErro('Selecione a escola em que você atua.');
      return;
    }
    setEnviando(true);
    try {
      const resp = await api.registrar({
        nome, email, senha, perfil,
        escola_id: ehCidadao ? null : Number(escolaId),
      });
      setSucesso(resp.mensagem);
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (sucesso) {
    return (
      <div className="tela-login">
        <div className="card form form-login">
          <h1>Conta criada</h1>
          <p className="alerta-sucesso" role="status">{sucesso}</p>
          <button className="btn btn--primario" onClick={onVoltar}>Ir para o login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="tela-login">
      <form className="card form form-login" onSubmit={enviar} aria-labelledby="titulo-cadastro">
        <h1 id="titulo-cadastro">Criar conta</h1>
        <p className="subtitulo-login">Itaitinga Conectada</p>

        {erro && <p className="alerta-erro" role="alert">{erro}</p>}

        <div className="campo">
          <label htmlFor="perfil">Eu sou</label>
          <select id="perfil" value={perfil} onChange={(e) => setPerfil(e.target.value)}>
            {PERFIS.map((p) => (
              <option key={p} value={p}>{ROTULOS.perfil[p]}</option>
            ))}
          </select>
        </div>

        <div className="campo">
          <label htmlFor="nome">Nome</label>
          <input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>

        <div className="campo">
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="campo">
          <label htmlFor="senha">Senha</label>
          <input id="senha" type="password" autoComplete="new-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
        </div>

        {!ehCidadao && (
          <div className="campo">
            <label htmlFor="escola">Escola</label>
            <select id="escola" value={escolaId} onChange={(e) => setEscolaId(e.target.value)}>
              <option value="">Selecione…</option>
              {escolas.map((e) => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>
          </div>
        )}

        <button type="submit" className="btn btn--primario" disabled={enviando}>
          {enviando ? 'Enviando…' : 'Criar conta'}
        </button>

        <button type="button" className="link-voltar" onClick={onVoltar}>
          ← Voltar ao login
        </button>
      </form>
    </div>
  );
}
