// Autocadastro público. Todos confirmam o e-mail por código; os perfis
// privilegiados (equipe/gestão/secretaria) ainda ficam pendentes de aprovação.
import { useEffect, useState } from 'react';
import { api, ROTULOS } from '../api.js';

// Perfis oferecidos no autocadastro (na ordem exibida).
const PERFIS = ['cidadao', 'professor', 'coordenacao', 'secretaria_escolar', 'direcao', 'secretaria'];

export default function Cadastro({ onVoltar, onRegistrado }) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [perfil, setPerfil] = useState('cidadao');
  const [cargo, setCargo] = useState('');
  const [matricula, setMatricula] = useState('');
  const [escolaId, setEscolaId] = useState('');
  const [escolas, setEscolas] = useState([]);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const ehCidadao = perfil === 'cidadao';
  const ehMunicipal = perfil === 'secretaria';
  // Perfis de escola precisam vincular uma escola (cidadão e secretaria
  // municipal não têm escola).
  const precisaEscola = !ehCidadao && !ehMunicipal;

  useEffect(() => {
    api.listarEscolasPublicas().then(setEscolas).catch(() => {});
  }, []);

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    if (senha.length < 6) {
      setErro('A senha deve ter ao menos 6 caracteres.');
      return;
    }
    if (precisaEscola && !escolaId) {
      setErro('Selecione a escola em que você atua.');
      return;
    }
    setEnviando(true);
    try {
      await api.registrar({
        nome,
        email,
        senha,
        perfil,
        escola_id: precisaEscola ? Number(escolaId) : null,
        cargo: ehCidadao ? null : cargo,
        matricula_funcional: ehCidadao ? null : matricula,
      });
      onRegistrado(email.trim().toLowerCase());
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
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
          {!ehCidadao && (
            <p className="dica-campo">
              Perfis de escola/gestão passam por <strong>aprovação de um responsável</strong> antes
              de liberar o acesso aos dados dos alunos.
            </p>
          )}
        </div>

        <div className="campo">
          <label htmlFor="nome">Nome</label>
          <input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>

        <div className="campo">
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" autoComplete="username" required value={email}
            onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="campo">
          <label htmlFor="senha">Senha</label>
          <input id="senha" type="password" autoComplete="new-password" required value={senha}
            onChange={(e) => setSenha(e.target.value)} />
        </div>

        {!ehCidadao && (
          <>
            <div className="campo">
              <label htmlFor="cargo">Cargo / função</label>
              <input id="cargo" value={cargo} onChange={(e) => setCargo(e.target.value)}
                placeholder="Ex.: Secretária escolar, Diretor(a)" />
            </div>
            <div className="campo">
              <label htmlFor="matricula">Matrícula funcional</label>
              <input id="matricula" value={matricula} onChange={(e) => setMatricula(e.target.value)}
                placeholder="Nº de matrícula do servidor" />
            </div>
          </>
        )}

        {precisaEscola && (
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
