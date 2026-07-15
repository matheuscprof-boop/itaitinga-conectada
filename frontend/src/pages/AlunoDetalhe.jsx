// Tela de detalhe: dados do aluno + eixos (Saúde/Assistência/Vida Escolar) +
// registro e acompanhamento dos alertas.
import { useEffect, useState } from 'react';
import { api, podeGerenciar } from '../api.js';
import AlunoCard from '../components/AlunoCard.jsx';
import AlunoForm from '../components/AlunoForm.jsx';
import AlertaForm from '../components/AlertaForm.jsx';
import AlertaList from '../components/AlertaList.jsx';
import SaudeAluno from '../components/SaudeAluno.jsx';
import AssistenciaAluno from '../components/AssistenciaAluno.jsx';
import VidaEscolarAluno from '../components/VidaEscolarAluno.jsx';
import DocumentosAluno from '../components/DocumentosAluno.jsx';

const ABAS = [
  { id: 'alertas', rotulo: 'Alertas' },
  { id: 'saude', rotulo: 'Saúde' },
  { id: 'assistencia', rotulo: 'Assistência' },
  { id: 'vida', rotulo: 'Vida Escolar' },
  { id: 'documentos', rotulo: 'Documentos' },
];

export default function AlunoDetalhe({ alunoId, perfil, onVoltar }) {
  const gestor = podeGerenciar(perfil);
  // Qualquer perfil de equipe (inclusive professor) registra dados dos eixos.
  const podeEditarEixos = perfil !== 'cidadao';
  const [aluno, setAluno] = useState(null);
  const [editando, setEditando] = useState(false);
  const [aba, setAba] = useState('alertas');
  const [erro, setErro] = useState('');

  async function carregar() {
    try {
      setAluno(await api.obterAluno(alunoId));
    } catch (err) {
      setErro(err.message);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alunoId]);

  async function salvarEdicao(dados) {
    await api.atualizarAluno(alunoId, dados);
    setEditando(false);
    carregar();
  }

  async function removerAluno() {
    if (!confirm(`Remover o aluno "${aluno.nome}"? Os alertas também serão apagados.`)) return;
    await api.removerAluno(alunoId);
    onVoltar();
  }

  async function registrarAlerta(dados) {
    await api.criarAlerta(dados);
    carregar();
  }

  async function mudarStatus(id, status) {
    await api.atualizarStatusAlerta(id, status);
    carregar();
  }

  async function removerAlerta(id) {
    await api.removerAlerta(id);
    carregar();
  }

  if (erro) return <p className="alerta-erro" role="alert">{erro}</p>;
  if (!aluno) return <p className="vazio" role="status">Carregando…</p>;

  return (
    <div className="detalhe">
      <button className="btn btn--voltar" onClick={onVoltar}>
        ← Voltar para a lista
      </button>

      {editando ? (
        <AlunoForm aluno={aluno} onSalvar={salvarEdicao} onCancelar={() => setEditando(false)} />
      ) : (
        <AlunoCard
          aluno={aluno}
          podeGerenciar={gestor}
          onEditar={() => setEditando(true)}
          onRemover={removerAluno}
          onAtualizar={carregar}
        />
      )}

      <nav className="eixos-abas" aria-label="Eixos do aluno">
        {ABAS.map((a) => (
          <button
            key={a.id}
            className={`eixo-aba ${aba === a.id ? 'eixo-aba--ativa' : ''}`}
            aria-current={aba === a.id ? 'page' : undefined}
            onClick={() => setAba(a.id)}
          >
            {a.rotulo}
          </button>
        ))}
      </nav>

      {aba === 'alertas' && (
        <section aria-labelledby="titulo-secao-alertas" className="secao-alertas">
          <h2 id="titulo-secao-alertas">Alertas</h2>
          <div className="detalhe-colunas">
            <AlertaForm alunoId={alunoId} onSalvar={registrarAlerta} />
            <AlertaList
              alertas={aluno.alertas || []}
              podeRemover={gestor}
              onMudarStatus={mudarStatus}
              onRemover={removerAlerta}
            />
          </div>
        </section>
      )}

      {aba === 'saude' && <SaudeAluno alunoId={alunoId} sexo={aluno.sexo} podeEditar={podeEditarEixos} />}
      {aba === 'assistencia' && <AssistenciaAluno alunoId={alunoId} podeEditar={podeEditarEixos} />}
      {aba === 'vida' && <VidaEscolarAluno alunoId={alunoId} podeEditar={podeEditarEixos} />}
      {aba === 'documentos' && <DocumentosAluno alunoId={alunoId} podeGerenciar={gestor} />}
    </div>
  );
}
