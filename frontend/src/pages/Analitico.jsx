// Painel Analítico: ferramenta de visualização por eixo e outras dimensões.
// Inclui distribuição (barras/rosca), evolução no tempo (linha) e mapeamento
// cruzado (heatmap). Voltado à gestão escolar, professores e secretarias.
import { useEffect, useState } from 'react';
import { api, ROTULOS, ehSecretaria } from '../api.js';
import FiltrosAlertas, { FILTROS_VAZIOS } from '../components/FiltrosAlertas.jsx';
import BarChart from '../components/BarChart.jsx';
import DonutChart from '../components/DonutChart.jsx';
import LineChart from '../components/LineChart.jsx';
import Heatmap from '../components/Heatmap.jsx';

const DIMENSOES_BASE = [
  { valor: 'eixo', rotulo: 'Eixo' },
  { valor: 'nivel', rotulo: 'Nível' },
  { valor: 'status', rotulo: 'Status' },
  { valor: 'turma', rotulo: 'Turma' },
  { valor: 'mes', rotulo: 'Mês' },
];

export default function Analitico({ perfil }) {
  const secretaria = ehSecretaria(perfil);
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [turmas, setTurmas] = useState([]);
  const [escolas, setEscolas] = useState([]);
  const [agruparPor, setAgruparPor] = useState('eixo');

  // Mapa id→nome de escola para rotular os gráficos.
  const escolaNome = Object.fromEntries(escolas.map((e) => [String(e.id), e.nome]));

  // Rótulo legível para a chave de uma dimensão.
  function rotular(dim, chave) {
    if (dim === 'mes') {
      const [ano, mes] = String(chave).split('-');
      return mes ? `${mes}/${ano}` : chave;
    }
    if (dim === 'escola') return escolaNome[String(chave)] ?? `Escola ${chave}`;
    return ROTULOS[dim]?.[chave] ?? chave;
  }

  // A Secretaria também pode agrupar/cruzar por escola.
  const DIMENSOES = secretaria
    ? [...DIMENSOES_BASE, { valor: 'escola', rotulo: 'Escola' }]
    : DIMENSOES_BASE;
  const [tipoGrafico, setTipoGrafico] = useState('barras'); // 'barras' | 'rosca'
  const [cruzarCom, setCruzarCom] = useState('turma'); // dimensão do mapeamento (eixo × ?)

  const [serie, setSerie] = useState([]);
  const [evolucao, setEvolucao] = useState([]);
  const [matriz, setMatriz] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    api.listarTurmas().then(setTurmas).catch(() => {});
    if (secretaria) api.listarEscolas().then(setEscolas).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recarrega os três blocos sempre que filtros/seletores mudam.
  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro('');
    Promise.all([
      api.serieRelatorio(agruparPor, filtros),
      api.serieRelatorio('mes', filtros),
      api.matrizRelatorio('eixo', cruzarCom, filtros),
    ])
      .then(([s, ev, m]) => {
        if (!ativo) return;
        setSerie(s.serie);
        setEvolucao(ev.serie);
        setMatriz(m);
      })
      .catch((e) => ativo && setErro(e.message))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [filtros, agruparPor, cruzarCom]);

  function alterarFiltro(campo, valor) {
    setFiltros((f) => ({ ...f, [campo]: valor }));
  }

  const dadosDistribuicao = serie.map((s) => ({ rotulo: rotular(agruparPor, s.chave), valor: s.total }));
  const dadosEvolucao = evolucao.map((s) => ({ rotulo: rotular('mes', s.chave), valor: s.total }));

  return (
    <div className="painel area-relatorio">
      <div className="secao-cabecalho">
        <h2>Painel analítico</h2>
        <button className="btn nao-imprimir" onClick={() => window.print()}>
          Imprimir / PDF
        </button>
      </div>

      <FiltrosAlertas
        filtros={filtros}
        turmas={turmas}
        escolas={escolas}
        onAlterar={alterarFiltro}
        onLimpar={() => setFiltros(FILTROS_VAZIOS)}
      />

      {erro && <p className="alerta-erro" role="alert">{erro}</p>}
      {carregando && <p className="vazio" role="status">Calculando…</p>}

      {/* --- Distribuição por dimensão --- */}
      <section className="card" aria-labelledby="titulo-distribuicao">
        <div className="secao-cabecalho">
          <h3 id="titulo-distribuicao">Distribuição</h3>
          <div className="controles-grafico nao-imprimir">
            <label htmlFor="agrupar">Agrupar por</label>
            <select id="agrupar" value={agruparPor} onChange={(e) => setAgruparPor(e.target.value)}>
              {DIMENSOES.map((d) => (
                <option key={d.valor} value={d.valor}>{d.rotulo}</option>
              ))}
            </select>

            <div className="toggle" role="group" aria-label="Tipo de gráfico">
              <button
                className={`btn btn--pequeno ${tipoGrafico === 'barras' ? 'btn--primario' : ''}`}
                aria-pressed={tipoGrafico === 'barras'}
                onClick={() => setTipoGrafico('barras')}
              >
                Barras
              </button>
              <button
                className={`btn btn--pequeno ${tipoGrafico === 'rosca' ? 'btn--primario' : ''}`}
                aria-pressed={tipoGrafico === 'rosca'}
                onClick={() => setTipoGrafico('rosca')}
              >
                Rosca
              </button>
            </div>
          </div>
        </div>

        {tipoGrafico === 'barras' ? (
          <BarChart dados={dadosDistribuicao} />
        ) : (
          <DonutChart dados={dadosDistribuicao} />
        )}
      </section>

      {/* --- Evolução no tempo --- */}
      <section className="card" aria-labelledby="titulo-evolucao">
        <h3 id="titulo-evolucao">Evolução no tempo (por mês)</h3>
        <LineChart pontos={dadosEvolucao} />
      </section>

      {/* --- Mapeamento (heatmap) eixo × dimensão --- */}
      <section className="card" aria-labelledby="titulo-mapeamento">
        <div className="secao-cabecalho">
          <h3 id="titulo-mapeamento">Mapeamento por eixo</h3>
          <div className="controles-grafico nao-imprimir">
            <label htmlFor="cruzar">Cruzar eixo com</label>
            <select id="cruzar" value={cruzarCom} onChange={(e) => setCruzarCom(e.target.value)}>
              {DIMENSOES.filter((d) => d.valor !== 'eixo').map((d) => (
                <option key={d.valor} value={d.valor}>{d.rotulo}</option>
              ))}
            </select>
          </div>
        </div>

        {matriz && (
          <Heatmap
            linhas={matriz.linhas}
            colunas={matriz.colunas}
            celulas={matriz.celulas}
            rotuloLinha={(v) => rotular('eixo', v)}
            rotuloColuna={(v) => rotular(cruzarCom, v)}
          />
        )}
      </section>
    </div>
  );
}
