// Tela inicial: resumo de alertas por eixo + lista de alunos + cadastro.
import { useEffect, useState } from 'react';
import { api, ROTULOS, podeGerenciar, ehSecretaria } from '../api.js';
import AlunoList from '../components/AlunoList.jsx';
import AlunoForm from '../components/AlunoForm.jsx';

const EIXOS = ['frequencia', 'desempenho', 'socioemocional'];
const ICONE_EIXO = { frequencia: '📅', desempenho: '📝', socioemocional: '💬' };

export default function Dashboard({ perfil, onAbrirAluno }) {
  const podeCriar = podeGerenciar(perfil);
  const [escolas, setEscolas] = useState([]);
  const [alunos, setAlunos] = useState([]);
  const [resumo, setResumo] = useState({});
  const [busca, setBusca] = useState('');
  const [mostrandoForm, setMostrandoForm] = useState(false);
  const [carregando, setCarregando] = useState(true);

  // Recarrega lista de alunos (com o filtro atual) e o resumo de alertas.
  async function carregar(q = busca) {
    setCarregando(true);
    const [listaAlunos, resumoAlertas] = await Promise.all([
      api.listarAlunos(q),
      api.resumoAlertas(),
    ]);
    setAlunos(listaAlunos);
    setResumo(resumoAlertas);
    setCarregando(false);
  }

  useEffect(() => {
    carregar('');
    // A Secretaria escolhe a escola ao cadastrar um aluno.
    if (ehSecretaria(perfil)) api.listarEscolas().then(setEscolas).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function aoBuscar(valor) {
    setBusca(valor);
    carregar(valor);
  }

  async function salvarNovoAluno(dados) {
    const aluno = await api.criarAluno(dados);
    setMostrandoForm(false);
    onAbrirAluno(aluno.id); // vai direto para o detalhe do aluno criado
  }

  return (
    <div className="painel">
      <section aria-labelledby="titulo-resumo">
        <h2 id="titulo-resumo">Panorama de alertas em aberto</h2>
        <div className="cards-resumo">
          {EIXOS.map((eixo) => (
            <div key={eixo} className={`card card--metrica metrica--${eixo}`}>
              <span className="metrica-ic" aria-hidden="true">{ICONE_EIXO[eixo]}</span>
              <span className="metrica-valor">{resumo[eixo] ?? 0}</span>
              <span className="metrica-rotulo">{ROTULOS.eixo[eixo]}</span>
            </div>
          ))}
        </div>
      </section>

      {mostrandoForm ? (
        <AlunoForm escolas={escolas} onSalvar={salvarNovoAluno} onCancelar={() => setMostrandoForm(false)} />
      ) : (
        <AlunoList
          alunos={alunos}
          busca={busca}
          podeCriar={podeCriar}
          onBuscar={aoBuscar}
          onAbrir={onAbrirAluno}
          onNovo={() => setMostrandoForm(true)}
        />
      )}

      {carregando && <p className="vazio" role="status">Carregando…</p>}
    </div>
  );
}
