// Página de relatórios: filtros combináveis, painel de agregados e
// exportação em CSV dos alertas filtrados.
import { useEffect, useState } from 'react';
import { api, ROTULOS, ehSecretaria } from '../api.js';
import BarChart from '../components/BarChart.jsx';
import FiltrosAlertas, { FILTROS_VAZIOS } from '../components/FiltrosAlertas.jsx';

export default function Relatorios({ perfil }) {
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [turmas, setTurmas] = useState([]);
  const [escolas, setEscolas] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  // Carrega turmas (e escolas, para a Secretaria) uma vez.
  useEffect(() => {
    api.listarTurmas().then(setTurmas).catch(() => {});
    if (ehSecretaria(perfil)) api.listarEscolas().then(setEscolas).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recarrega o resumo sempre que os filtros mudam.
  useEffect(() => {
    setCarregando(true);
    setErro('');
    api
      .resumoRelatorio(filtros)
      .then(setResumo)
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [filtros]);

  function alterar(campo, valor) {
    setFiltros((f) => ({ ...f, [campo]: valor }));
  }

  async function exportar() {
    try {
      await api.baixarCsv(filtros);
    } catch (e) {
      setErro(e.message);
    }
  }

  // Usa o diálogo de impressão do navegador (permite "Salvar como PDF").
  function imprimir() {
    window.print();
  }

  return (
    <div className="painel area-relatorio">
      <div className="secao-cabecalho">
        <h2>Relatórios de alertas</h2>
        <div className="form-acoes nao-imprimir">
          <button className="btn" onClick={imprimir}>
            Imprimir / PDF
          </button>
          <button className="btn btn--primario" onClick={exportar}>
            Exportar CSV
          </button>
        </div>
      </div>

      <FiltrosAlertas
        filtros={filtros}
        turmas={turmas}
        escolas={escolas}
        onAlterar={alterar}
        onLimpar={() => setFiltros(FILTROS_VAZIOS)}
      />

      {erro && <p className="alerta-erro" role="alert">{erro}</p>}
      {carregando && <p className="vazio" role="status">Calculando…</p>}

      {/* --- Resultados --- */}
      {resumo && (resumo.total === 0 ? (
        <p className="vazio" role="status">Nenhum alerta corresponde ao filtro atual.</p>
      ) : (
        <>
          <ResumoCabecalho resumo={resumo} />

          <div className="grupos-metricas">
            <GrupoGrafico titulo="Por eixo" ajuda="Dimensão pedagógica do alerta." mapa={resumo.por_eixo} rotulos={ROTULOS.eixo} cor="#1f5fbf" />
            <GrupoGrafico titulo="Por nível de risco" ajuda="Gravidade atribuída ao alerta." mapa={resumo.por_nivel} rotulos={ROTULOS.nivel} cor="#b8860b" />
            <GrupoGrafico titulo="Por situação" ajuda="Andamento do acompanhamento." mapa={resumo.por_status} rotulos={ROTULOS.status} cor="#1b7f5a" />
          </div>

          {resumo.por_categoria?.length > 0 && (
            <section aria-labelledby="titulo-por-categoria" className="card">
              <h3 id="titulo-por-categoria">Por categoria (violência e discriminação)</h3>
              <p className="dica-campo">Casos tipificados como bullying, racismo, LGBTfobia e afins.</p>
              <BarChart
                cor="#c0392b"
                dados={resumo.por_categoria.map((linha) => ({
                  rotulo: ROTULOS.categoriaAlerta[linha.categoria] || linha.categoria,
                  valor: linha.total,
                }))}
              />
            </section>
          )}

          <section aria-labelledby="titulo-por-turma" className="card">
            <h3 id="titulo-por-turma">Por turma</h3>
            {resumo.por_turma.length === 0 ? (
              <p className="vazio">Sem dados para o filtro atual.</p>
            ) : (
              <BarChart
                cor="#7c3aed"
                dados={resumo.por_turma.map((linha) => ({ rotulo: linha.turma, valor: linha.total }))}
              />
            )}
          </section>
        </>
      ))}
    </div>
  );
}

// Cabeçalho do resumo: frase legível + destaques (abertos / em andamento /
// resolvidos com percentual), para leitura rápida de quem não é técnico.
function ResumoCabecalho({ resumo }) {
  const total = resumo.total;
  const s = resumo.por_status || {};
  const abertos = s.aberto || 0;
  const emAndamento = s.em_andamento || 0;
  const resolvidos = s.resolvido || 0;
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);
  const pendentes = abertos + emAndamento;

  return (
    <div className="relatorio-resumo">
      <p className="relatorio-resumo__frase">
        No filtro atual há <strong>{total}</strong> alerta(s): <strong>{pendentes}</strong> ainda
        em acompanhamento ({pct(pendentes)}%) e <strong>{resolvidos}</strong> já resolvido(s)
        ({pct(resolvidos)}%).
      </p>
      <div className="relatorio-destaques">
        <Destaque rotulo="Abertos" valor={abertos} pct={pct(abertos)} classe="aberto" />
        <Destaque rotulo="Em andamento" valor={emAndamento} pct={pct(emAndamento)} classe="em_andamento" />
        <Destaque rotulo="Resolvidos" valor={resolvidos} pct={pct(resolvidos)} classe="resolvido" />
      </div>
    </div>
  );
}

function Destaque({ rotulo, valor, pct, classe }) {
  return (
    <div className={`relatorio-destaque relatorio-destaque--${classe}`}>
      <span className="relatorio-destaque__valor">{valor}</span>
      <span className="relatorio-destaque__rotulo">{rotulo}</span>
      <span className="relatorio-destaque__pct">{pct}%</span>
    </div>
  );
}

// Card com um gráfico de barras a partir de um mapa { chave: total }.
function GrupoGrafico({ titulo, ajuda, mapa, rotulos, cor }) {
  const dados = Object.entries(mapa).map(([chave, total]) => ({
    rotulo: rotulos[chave] ?? chave,
    valor: total,
  }));
  return (
    <div className="card grupo-metrica">
      <h3>{titulo}</h3>
      {ajuda && <p className="dica-campo">{ajuda}</p>}
      <BarChart dados={dados} cor={cor} />
    </div>
  );
}
