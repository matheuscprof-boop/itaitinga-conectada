// Tela de gestão de usuários (acesso restrito à Direção).
// Permite criar, editar e remover contas. Usa /api/auth/usuarios.
import { useEffect, useState } from 'react';
import { api, ROTULOS, ehSecretaria } from '../api.js';
import Badge from '../components/Badge.jsx';

const FORM_VAZIO = {
  nome: '', email: '', senha: '', perfil: 'professor', escola_id: '',
  turmas: [], cargo: '', matricula_funcional: '',
};

export default function Usuarios({ usuarioAtualId, perfil }) {
  const [usuarios, setUsuarios] = useState([]);
  const [pendentes, setPendentes] = useState([]);
  const [escolas, setEscolas] = useState([]);
  const [turmasDisponiveis, setTurmasDisponiveis] = useState([]);
  const [novaTurma, setNovaTurma] = useState('');
  const [form, setForm] = useState(FORM_VAZIO);
  const [editandoId, setEditandoId] = useState(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [salvando, setSalvando] = useState(false);

  const editando = editandoId !== null;
  const secretaria = ehSecretaria(perfil);
  // A secretaria também pode criar contas municipais (secretaria).
  const PERFIS = secretaria
    ? ['professor', 'coordenacao', 'secretaria_escolar', 'direcao', 'secretaria']
    : ['professor', 'coordenacao', 'secretaria_escolar', 'direcao'];
  // Escola é exigida para perfis que não são municipais.
  const precisaEscola = secretaria && form.perfil !== 'secretaria';

  async function carregar() {
    try {
      setUsuarios(await api.listarUsuarios());
    } catch (e) {
      setErro(e.message);
    }
  }

  async function carregarPendentes() {
    try {
      setPendentes(await api.listarPendentes());
    } catch { /* ignora: seção some se não houver */ }
  }

  useEffect(() => {
    carregar();
    carregarPendentes();
    api.listarTurmas().then(setTurmasDisponiveis).catch(() => {});
    if (secretaria) api.listarEscolas().then(setEscolas).catch(() => {});
  }, [secretaria]);

  async function aprovar(u) {
    setErro('');
    setAviso('');
    try {
      await api.aprovarUsuario(u.id);
      setAviso(`Conta de "${u.nome}" aprovada — o acesso foi liberado.`);
      carregar();
      carregarPendentes();
    } catch (e) {
      setErro(e.message);
    }
  }

  async function recusar(u) {
    if (!confirm(`Recusar e remover o cadastro de "${u.nome}"?`)) return;
    setErro('');
    setAviso('');
    try {
      await api.removerUsuario(u.id);
      carregar();
      carregarPendentes();
    } catch (e) {
      setErro(e.message);
    }
  }

  function alterar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  // Turmas oferecidas nas caixas: as do escopo + as já atribuídas ao professor.
  const turmasOpcoes = [...new Set([...turmasDisponiveis, ...form.turmas])].sort((a, b) =>
    a.localeCompare(b, 'pt-BR')
  );

  function alternarTurma(turma) {
    setForm((f) => ({
      ...f,
      turmas: f.turmas.includes(turma)
        ? f.turmas.filter((t) => t !== turma)
        : [...f.turmas, turma],
    }));
  }

  function adicionarTurma() {
    const t = novaTurma.trim();
    if (t && !form.turmas.includes(t)) alterar('turmas', [...form.turmas, t]);
    setNovaTurma('');
  }

  async function iniciarEdicao(u) {
    setEditandoId(u.id);
    setForm({
      nome: u.nome, email: u.email, senha: '', perfil: u.perfil,
      escola_id: u.escola_id ?? '', turmas: [],
      cargo: u.cargo ?? '', matricula_funcional: u.matricula_funcional ?? '',
    });
    setErro('');
    setAviso('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (u.perfil === 'professor') {
      try {
        const { turmas } = await api.listarTurmasProfessor(u.id);
        setForm((f) => ({ ...f, turmas }));
      } catch { /* ignora: mantém sem turmas */ }
    }
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setForm(FORM_VAZIO);
    setNovaTurma('');
    setErro('');
  }

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    setAviso('');
    setSalvando(true);
    try {
      if (editando) {
        // A senha só é enviada quando preenchida (senão mantém a atual).
        const dados = {
          nome: form.nome, email: form.email, perfil: form.perfil,
          cargo: form.cargo, matricula_funcional: form.matricula_funcional,
        };
        if (secretaria) dados.escola_id = precisaEscola ? form.escola_id : null;
        if (form.senha) dados.nova_senha = form.senha;
        await api.atualizarUsuario(editandoId, dados);
        if (form.perfil === 'professor') {
          await api.salvarTurmasProfessor(editandoId, form.turmas);
        }
        setAviso(`Usuário "${form.nome}" atualizado.`);
      } else {
        const dados = {
          nome: form.nome, email: form.email, senha: form.senha, perfil: form.perfil,
          cargo: form.cargo, matricula_funcional: form.matricula_funcional,
        };
        if (secretaria) dados.escola_id = precisaEscola ? form.escola_id : null;
        const criado = await api.criarUsuario(dados);
        if (form.perfil === 'professor' && form.turmas.length && criado?.id) {
          await api.salvarTurmasProfessor(criado.id, form.turmas);
        }
        setAviso(`Usuário "${form.nome}" criado com sucesso.`);
      }
      cancelarEdicao();
      carregar();
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function remover(usuario) {
    if (!confirm(`Remover o usuário "${usuario.nome}"?`)) return;
    setErro('');
    setAviso('');
    try {
      await api.removerUsuario(usuario.id);
      if (editandoId === usuario.id) cancelarEdicao();
      carregar();
    } catch (err) {
      setErro(err.message);
    }
  }

  return (
    <div className="painel">
      <h2>Gestão de usuários</h2>

      {erro && <p className="alerta-erro" role="alert">{erro}</p>}
      {aviso && <p className="alerta-sucesso" role="status">{aviso}</p>}

      <form className="card form" onSubmit={salvar} aria-labelledby="titulo-form-usuario">
        <h3 id="titulo-form-usuario">{editando ? 'Editar usuário' : 'Novo usuário'}</h3>
        <div className="form-grid">
          <div className="campo">
            <label htmlFor="u-nome">Nome <span aria-hidden="true">*</span></label>
            <input id="u-nome" type="text" required value={form.nome}
              onChange={(e) => alterar('nome', e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="u-email">E-mail <span aria-hidden="true">*</span></label>
            <input id="u-email" type="email" required value={form.email}
              onChange={(e) => alterar('email', e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="u-senha">
              {editando ? 'Nova senha (deixe em branco para manter)' : 'Senha'}
              {!editando && <span aria-hidden="true"> *</span>}
            </label>
            <input id="u-senha" type="password" required={!editando} minLength={6}
              autoComplete="new-password" value={form.senha}
              onChange={(e) => alterar('senha', e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="u-perfil">Perfil</label>
            <select id="u-perfil" value={form.perfil} onChange={(e) => alterar('perfil', e.target.value)}>
              {PERFIS.map((p) => (
                <option key={p} value={p}>{ROTULOS.perfil[p]}</option>
              ))}
            </select>
          </div>

          {precisaEscola && (
            <div className="campo">
              <label htmlFor="u-escola">Escola <span aria-hidden="true">*</span></label>
              <select id="u-escola" required value={form.escola_id}
                onChange={(e) => alterar('escola_id', e.target.value)}>
                <option value="">Selecione…</option>
                {escolas.map((e) => (
                  <option key={e.id} value={e.id}>{e.nome}</option>
                ))}
              </select>
            </div>
          )}

          <div className="campo">
            <label htmlFor="u-cargo">Cargo / função</label>
            <input id="u-cargo" type="text" value={form.cargo}
              onChange={(e) => alterar('cargo', e.target.value)}
              placeholder="Ex.: Secretária escolar" />
          </div>
          <div className="campo">
            <label htmlFor="u-matricula">Matrícula funcional</label>
            <input id="u-matricula" type="text" value={form.matricula_funcional}
              onChange={(e) => alterar('matricula_funcional', e.target.value)}
              placeholder="Nº do servidor" />
          </div>
        </div>

        {form.perfil === 'professor' && (
          <fieldset className="campo turmas-responsavel">
            <legend>Turmas de responsabilidade</legend>
            <p className="ajuda">
              O professor recebe por e-mail os alertas dos alunos das turmas marcadas
              (nível alto, surto e área de risco).
            </p>
            {turmasOpcoes.length > 0 && (
              <div className="turmas-opcoes" role="group" aria-label="Turmas disponíveis">
                {turmasOpcoes.map((t) => (
                  <label key={t} className="turma-check">
                    <input
                      type="checkbox"
                      checked={form.turmas.includes(t)}
                      onChange={() => alternarTurma(t)}
                    />
                    {t}
                  </label>
                ))}
              </div>
            )}
            <div className="turma-adicionar">
              <input
                type="text"
                aria-label="Adicionar turma"
                placeholder="Adicionar turma (ex.: 9º A)"
                value={novaTurma}
                onChange={(e) => setNovaTurma(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); adicionarTurma(); }
                }}
              />
              <button type="button" className="btn btn--pequeno" onClick={adicionarTurma}>
                Adicionar
              </button>
            </div>
          </fieldset>
        )}
        <div className="form-acoes">
          <button type="submit" className="btn btn--primario" disabled={salvando}>
            {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Criar usuário'}
          </button>
          {editando && (
            <button type="button" className="btn" onClick={cancelarEdicao}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      {pendentes.length > 0 && (
        <section aria-labelledby="titulo-pendentes" className="secao-pendentes">
          <h3 id="titulo-pendentes">
            Pendentes de aprovação
            <span className="contador-nav" aria-label={`${pendentes.length} pendentes`}>{pendentes.length}</span>
          </h3>
          <p className="ajuda">
            Contas que confirmaram o e-mail e aguardam liberação. Aprove apenas quem você
            reconhece como parte da rede.
          </p>
          <ul className="lista" role="list">
            {pendentes.map((u) => (
              <li key={u.id} className="lista-item-info">
                <div>
                  <strong>{u.nome}</strong>
                  <span className="lista-item-sub">
                    {u.email}
                    {u.escola_nome ? ` · ${u.escola_nome}` : u.perfil === 'secretaria' ? ' · Municipal' : ''}
                    {u.cargo ? ` · ${u.cargo}` : ''}
                    {u.matricula_funcional ? ` · matrícula ${u.matricula_funcional}` : ''}
                  </span>
                </div>
                <div className="usuario-acoes">
                  <Badge tipo="perfil" valor={u.perfil} />
                  <button className="btn btn--pequeno btn--primario" onClick={() => aprovar(u)}>
                    Aprovar
                  </button>
                  <button className="btn btn--pequeno btn--perigo" onClick={() => recusar(u)}>
                    Recusar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="titulo-lista-usuarios">
        <h3 id="titulo-lista-usuarios">Usuários cadastrados</h3>
        {usuarios.length === 0 ? (
          <p className="vazio">Nenhum usuário cadastrado.</p>
        ) : (
          <ul className="lista" role="list">
            {usuarios.map((u) => (
              <li key={u.id} className="lista-item-info">
                <div>
                  <strong>{u.nome}</strong>
                  <span className="lista-item-sub">
                    {u.email}
                    {u.escola_nome ? ` · ${u.escola_nome}` : u.perfil === 'secretaria' ? ' · Municipal' : ''}
                    {u.cargo ? ` · ${u.cargo}` : ''}
                    {u.status === 'pendente' ? ' · aguardando aprovação' : ''}
                  </span>
                </div>
                <div className="usuario-acoes">
                  <Badge tipo="perfil" valor={u.perfil} />
                  <button className="btn btn--pequeno" onClick={() => iniciarEdicao(u)}>
                    Editar
                  </button>
                  {u.id === usuarioAtualId ? (
                    <span className="marca-voce">você</span>
                  ) : (
                    <button className="btn btn--pequeno btn--perigo" onClick={() => remover(u)}>
                      Remover
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
