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
import MenuSuspenso from './components/MenuSuspenso.jsx';
import Usuarios from './pages/Usuarios.jsx';
import MinhaConta from './pages/MinhaConta.jsx';
import Notificacoes from './pages/Notificacoes.jsx';

export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [naoLidas, setNaoLidas] = useState(0);
  const [telaPublica, setTelaPublica] = useState('login'); // login | cadastro | portal | verificar
  const [emailPendente, setEmailPendente] = useState(''); // e-mail em verificação
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

      <header className="cabecalho-app">
        <div className="cabecalho-conteudo">
          <button
            className="logo"
            onClick={() => setView({ tela: cidadao ? 'infraestrutura' : 'dashboard' })}
            aria-label="Ir para a página inicial"
          >
            Itaitinga Conectada
          </button>

          <nav className="nav-principal" aria-label="Navegação principal">
            {cidadao ? (
              <button
                className={`nav-item ${view.tela === 'infraestrutura' ? 'nav-item--ativo' : ''}`}
                onClick={() => setView({ tela: 'infraestrutura' })}
              >
                Infraestrutura
              </button>
            ) : (
              <>
                <button
                  className={`nav-item ${view.tela === 'dashboard' ? 'nav-item--ativo' : ''}`}
                  onClick={() => setView({ tela: 'dashboard' })}
                >
                  Início
                </button>

                {/* Grupo "Análises": relatórios, painel analítico e mapa. */}
                <MenuSuspenso
                  rotulo="Análises"
                  ativo={['relatorios', 'analitico', 'mapa'].includes(view.tela)}
                >
                  <button className="menu-suspenso__item" onClick={() => setView({ tela: 'relatorios' })}>
                    Relatórios
                  </button>
                  <button className="menu-suspenso__item" onClick={() => setView({ tela: 'analitico' })}>
                    Painel analítico
                  </button>
                  <button className="menu-suspenso__item" onClick={() => setView({ tela: 'mapa' })}>
                    Mapa das escolas
                  </button>
                </MenuSuspenso>

                {gestao && (
                  <button
                    className={`nav-item ${view.tela === 'saude' ? 'nav-item--ativo' : ''}`}
                    onClick={() => setView({ tela: 'saude' })}
                  >
                    Saúde
                  </button>
                )}
                <button
                  className={`nav-item ${view.tela === 'infraestrutura' ? 'nav-item--ativo' : ''}`}
                  onClick={() => setView({ tela: 'infraestrutura' })}
                >
                  Infraestrutura
                </button>
                {gestao && (
                  <button
                    className={`nav-item ${view.tela === 'notificacoes' ? 'nav-item--ativo' : ''}`}
                    onClick={() => setView({ tela: 'notificacoes' })}
                  >
                    Notificações
                    {naoLidas > 0 && <span className="contador-nav" aria-label={`${naoLidas} não lidas`}>{naoLidas}</span>}
                  </button>
                )}

                {/* Grupo "Gestão": cadastros administrativos (escolas e usuários). */}
                {(usuario.perfil === 'secretaria' || usuario.perfil === 'direcao') && (
                  <MenuSuspenso
                    rotulo="Gestão"
                    ativo={['escolas', 'usuarios'].includes(view.tela)}
                  >
                    {usuario.perfil === 'secretaria' && (
                      <button className="menu-suspenso__item" onClick={() => setView({ tela: 'escolas' })}>
                        Escolas
                      </button>
                    )}
                    <button className="menu-suspenso__item" onClick={() => setView({ tela: 'usuarios' })}>
                      Usuários
                    </button>
                  </MenuSuspenso>
                )}
              </>
            )}
            <button
              className={`nav-item ${view.tela === 'conta' ? 'nav-item--ativo' : ''}`}
              onClick={() => setView({ tela: 'conta' })}
            >
              Minha conta
            </button>
          </nav>

          <div className="usuario-box">
            <span className="usuario-nome">
              {usuario.nome}
              <span className="usuario-perfil">{ROTULOS.perfil[usuario.perfil]}</span>
            </span>
            <button className="btn btn--pequeno" onClick={sair}>Sair</button>
          </div>
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
    </>
  );
}

// Cabeçalho mínimo para o portal público (usuário não autenticado).
function PortalPublicoShell({ children, onVoltar }) {
  return (
    <>
      <header className="cabecalho-app">
        <div className="cabecalho-conteudo">
          <button className="logo" onClick={onVoltar} aria-label="Voltar ao login">
            Itaitinga Conectada
          </button>
          <nav className="nav-principal">
            <button className="nav-item" onClick={onVoltar}>← Login</button>
          </nav>
        </div>
      </header>
      <main id="conteudo" className="conteudo">{children}</main>
      <footer className="rodape-app">
        <p>Itaitinga Conectada · Portal público de infraestrutura</p>
      </footer>
    </>
  );
}
