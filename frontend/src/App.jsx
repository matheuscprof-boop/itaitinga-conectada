// Componente raiz. Controla a autenticação e faz uma navegação simples entre
// as telas — sem biblioteca de rotas, para manter o MVP enxuto.
//
// Três experiências conforme o estado/perfil:
//   - Não autenticado: login, autocadastro ou portal público de infraestrutura.
//   - Cidadão: apenas o eixo de Infraestrutura/Cidadania.
//   - Equipe/Secretaria: acompanhamento estudantil + Infraestrutura.
import { useEffect, useState } from 'react';
import { api, getToken, ROTULOS, podeGerenciar, ehCidadao } from './api.js';
import Login from './pages/Login.jsx';
import Cadastro from './pages/Cadastro.jsx';
import VerificarEmail from './pages/VerificarEmail.jsx';
import PortalCidadao from './pages/PortalCidadao.jsx';
import Dashboard from './pages/Dashboard.jsx';
import AlunoDetalhe from './pages/AlunoDetalhe.jsx';
import Relatorios from './pages/Relatorios.jsx';
import Analitico from './pages/Analitico.jsx';
import Mapa from './pages/Mapa.jsx';
import PanoramaSaude from './pages/PanoramaSaude.jsx';
import Escolas from './pages/Escolas.jsx';
import Usuarios from './pages/Usuarios.jsx';
import MinhaConta from './pages/MinhaConta.jsx';
import Notificacoes from './pages/Notificacoes.jsx';

export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [naoLidas, setNaoLidas] = useState(0);
  const [telaPublica, setTelaPublica] = useState('login'); // login | cadastro | portal | verificar
  const [emailPendente, setEmailPendente] = useState(''); // e-mail em verificação
  const [menuAberto, setMenuAberto] = useState(false); // gaveta do menu lateral (celular)
  // view = { tela: 'dashboard' | 'detalhe' | 'relatorios' | 'infraestrutura' | ... }
  const [view, setView] = useState({ tela: 'dashboard' });

  const gestao = usuario ? podeGerenciar(usuario.perfil) : false;
  const cidadao = usuario ? ehCidadao(usuario.perfil) : false;

  // Atualiza a contagem de notificações não lidas (perfis de gestão).
  function atualizarNaoLidas() {
    if (!usuario || !podeGerenciar(usuario.perfil)) return;
    api
      .listarNotificacoes(true)
      .then((r) => setNaoLidas(r.nao_lidas))
      .catch(() => {});
  }

  useEffect(() => {
    atualizarNaoLidas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

  // Ao abrir a aplicação, valida o token guardado (se houver).
  useEffect(() => {
    if (!getToken()) {
      setCarregando(false);
      return;
    }
    api
      .eu()
      .then((u) => setUsuario(u))
      .catch(() => api.logout())
      .finally(() => setCarregando(false));
  }, []);

  // Se qualquer chamada retornar 401, volta para a tela de login.
  useEffect(() => {
    const aoExpirar = () => setUsuario(null);
    window.addEventListener('saae:sessao-expirada', aoExpirar);
    return () => window.removeEventListener('saae:sessao-expirada', aoExpirar);
  }, []);

  // Ao logar, cidadão começa na Infraestrutura; equipe no painel.
  function aoLogar(u) {
    setUsuario(u);
    setView({ tela: ehCidadao(u.perfil) ? 'infraestrutura' : 'dashboard' });
  }

  function sair() {
    api.logout();
    setUsuario(null);
    setTelaPublica('login');
    setView({ tela: 'dashboard' });
  }

  function irPara(tela) {
    setView({ tela });
    setMenuAberto(false);
  }

  // Item do menu lateral. Fecha a gaveta ao navegar (no celular).
  function ItemNav({ tela, icone, rotulo, badge }) {
    const ativo = view.tela === tela;
    return (
      <button
        className={`sidebar-item ${ativo ? 'sidebar-item--ativo' : ''}`}
        onClick={() => irPara(tela)}
        aria-current={ativo ? 'page' : undefined}
      >
        <span className="sidebar-item__icone" aria-hidden="true">{icone}</span>
        <span className="sidebar-item__rotulo">{rotulo}</span>
        {badge > 0 && <span className="contador-nav" aria-label={`${badge} não lidas`}>{badge}</span>}
      </button>
    );
  }

  if (carregando) {
    return <p className="vazio" role="status" style={{ padding: '2rem' }}>Carregando…</p>;
  }

  // --- Não autenticado: login / cadastro / portal público ---
  if (!usuario) {
    if (telaPublica === 'cadastro') {
      return (
        <Cadastro
          onVoltar={() => setTelaPublica('login')}
          onRegistrado={(email) => { setEmailPendente(email); setTelaPublica('verificar'); }}
        />
      );
    }
    if (telaPublica === 'verificar') {
      return (
        <VerificarEmail
          email={emailPendente}
          onVerificado={() => setTelaPublica('login')}
          onVoltar={() => setTelaPublica('login')}
        />
      );
    }
    if (telaPublica === 'portal') {
      return (
        <PortalPublicoShell onVoltar={() => setTelaPublica('login')}>
          <PortalCidadao
            usuario={null}
            onEntrar={() => setTelaPublica('login')}
            onCadastrar={() => setTelaPublica('cadastro')}
          />
        </PortalPublicoShell>
      );
    }
    return (
      <Login
        onLogin={aoLogar}
        onCadastrar={() => setTelaPublica('cadastro')}
        onPortal={() => setTelaPublica('portal')}
        onPrecisaVerificar={(email) => { setEmailPendente(email); setTelaPublica('verificar'); }}
      />
    );
  }

  return (
    <>
      <a href="#conteudo" className="pular-para-conteudo">Pular para o conteúdo</a>

      <div className={`app-shell ${menuAberto ? 'menu-aberto' : ''}`}>
        <button
          className="sidebar-overlay"
          aria-label="Fechar menu"
          tabIndex={menuAberto ? 0 : -1}
          onClick={() => setMenuAberto(false)}
        />

        <aside className="sidebar">
          <button
            className="sidebar-marca"
            onClick={() => irPara(cidadao ? 'infraestrutura' : 'dashboard')}
            aria-label="Ir para a página inicial"
          >
            <img src="/marca/logo-horizontal.svg" alt="Itaitinga Conectada" />
          </button>

          <nav className="sidebar-nav" aria-label="Navegação principal">
            {cidadao ? (
              <>
                <ItemNav tela="infraestrutura" icone="🛠️" rotulo="Infraestrutura" />
                <ItemNav tela="conta" icone="👤" rotulo="Minha conta" />
              </>
            ) : (
              <>
                <p className="sidebar-grupo">Acompanhamento</p>
                <ItemNav tela="dashboard" icone="🏠" rotulo="Início" />
                <ItemNav tela="relatorios" icone="📄" rotulo="Relatórios" />
                <ItemNav tela="analitico" icone="📊" rotulo="Painel analítico" />
                <ItemNav tela="mapa" icone="🗺️" rotulo="Mapa das escolas" />

                <p className="sidebar-grupo">Cidadania</p>
                {gestao && <ItemNav tela="saude" icone="🩺" rotulo="Saúde" />}
                <ItemNav tela="infraestrutura" icone="🛠️" rotulo="Infraestrutura" />
                {gestao && <ItemNav tela="notificacoes" icone="🔔" rotulo="Notificações" badge={naoLidas} />}

                {(usuario.perfil === 'secretaria' || usuario.perfil === 'direcao') && (
                  <>
                    <p className="sidebar-grupo">Gestão</p>
                    {usuario.perfil === 'secretaria' && <ItemNav tela="escolas" icone="🏫" rotulo="Escolas" />}
                    <ItemNav tela="usuarios" icone="👥" rotulo="Usuários" />
                  </>
                )}

                <p className="sidebar-grupo">Conta</p>
                <ItemNav tela="conta" icone="👤" rotulo="Minha conta" />
              </>
            )}
          </nav>
        </aside>

        <div className="area-principal">
          <header className="topbar">
            <button
              className="topbar__menu-btn"
              onClick={() => setMenuAberto((a) => !a)}
              aria-label="Abrir menu"
              aria-expanded={menuAberto}
            >
              ☰
            </button>
            <div className="topbar__saudacao">
              <span className="topbar__ola">Olá, {usuario.nome.split(' ')[0]}</span>
              <span className="topbar__perfil">{ROTULOS.perfil[usuario.perfil]}</span>
            </div>
            <div className="topbar__acoes">
              <button className="btn btn--pequeno" onClick={sair}>Sair</button>
            </div>
          </header>

          <main id="conteudo" className="conteudo">
        {/* Telas de equipe */}
        {!cidadao && view.tela === 'dashboard' && (
          <Dashboard
            perfil={usuario.perfil}
            onAbrirAluno={(alunoId) => setView({ tela: 'detalhe', alunoId })}
          />
        )}
        {!cidadao && view.tela === 'detalhe' && (
          <AlunoDetalhe
            alunoId={view.alunoId}
            perfil={usuario.perfil}
            onVoltar={() => setView({ tela: 'dashboard' })}
          />
        )}
        {!cidadao && view.tela === 'relatorios' && <Relatorios perfil={usuario.perfil} />}
        {!cidadao && view.tela === 'analitico' && <Analitico perfil={usuario.perfil} />}
        {!cidadao && view.tela === 'mapa' && <Mapa />}
        {!cidadao && view.tela === 'saude' && gestao && <PanoramaSaude />}
        {!cidadao && view.tela === 'escolas' && usuario.perfil === 'secretaria' && <Escolas />}
        {!cidadao && view.tela === 'usuarios' && (usuario.perfil === 'direcao' || usuario.perfil === 'secretaria') && (
          <Usuarios usuarioAtualId={usuario.id} perfil={usuario.perfil} />
        )}
        {!cidadao && view.tela === 'notificacoes' && gestao && (
          <Notificacoes onMudou={setNaoLidas} />
        )}

        {/* Infraestrutura — disponível para cidadão e equipe */}
        {view.tela === 'infraestrutura' && <PortalCidadao usuario={usuario} />}

        {view.tela === 'conta' && <MinhaConta usuario={usuario} />}
      </main>

          <footer className="rodape-app">
            <p>Itaitinga Conectada · Educação e cidadania com foco em acessibilidade</p>
          </footer>
        </div>
      </div>
    </>
  );
}

// Shell do portal público (usuário não autenticado) — mesmo layout de menu
// lateral da área logada, com itens reduzidos ao acesso público.
function PortalPublicoShell({ children, onVoltar }) {
  const [menuAberto, setMenuAberto] = useState(false);
  return (
    <>
      <a href="#conteudo" className="pular-para-conteudo">Pular para o conteúdo</a>

      <div className={`app-shell ${menuAberto ? 'menu-aberto' : ''}`}>
        <button
          className="sidebar-overlay"
          aria-label="Fechar menu"
          tabIndex={menuAberto ? 0 : -1}
          onClick={() => setMenuAberto(false)}
        />

        <aside className="sidebar">
          <button className="sidebar-marca" onClick={onVoltar} aria-label="Ir para o login">
            <img src="/marca/logo-horizontal.svg" alt="Itaitinga Conectada" />
          </button>

          <nav className="sidebar-nav" aria-label="Navegação principal">
            <p className="sidebar-grupo">Portal público</p>
            <button className="sidebar-item sidebar-item--ativo" aria-current="page">
              <span className="sidebar-item__icone" aria-hidden="true">🛠️</span>
              <span className="sidebar-item__rotulo">Infraestrutura</span>
            </button>

            <p className="sidebar-grupo">Acesso</p>
            <button className="sidebar-item" onClick={onVoltar}>
              <span className="sidebar-item__icone" aria-hidden="true">🔑</span>
              <span className="sidebar-item__rotulo">Entrar</span>
            </button>
          </nav>
        </aside>

        <div className="area-principal">
          <header className="topbar">
            <button
              className="topbar__menu-btn"
              onClick={() => setMenuAberto((a) => !a)}
              aria-label="Abrir menu"
              aria-expanded={menuAberto}
            >
              ☰
            </button>
            <div className="topbar__saudacao">
              <span className="topbar__ola">Portal público</span>
              <span className="topbar__perfil">Infraestrutura e cidadania</span>
            </div>
            <div className="topbar__acoes">
              <button className="btn btn--primario btn--pequeno" onClick={onVoltar}>Entrar</button>
            </div>
          </header>

          <main id="conteudo" className="conteudo">{children}</main>

          <footer className="rodape-app">
            <p>Itaitinga Conectada · Portal público de infraestrutura</p>
          </footer>
        </div>
      </div>
    </>
  );
}
