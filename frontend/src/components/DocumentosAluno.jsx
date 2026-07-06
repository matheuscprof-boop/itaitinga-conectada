// Módulo de Documentos do aluno: lista organizada por categoria, com upload
// (gestão) e download. Gestores escolares gerenciam; demais perfis apenas veem.
import { useEffect, useState } from 'react';
import { api, ROTULOS } from '../api.js';

const CATEGORIAS = Object.keys(ROTULOS.categoriaDocumento);

export default function DocumentosAluno({ alunoId, podeGerenciar = false }) {
  const [documentos, setDocumentos] = useState([]);
  const [arquivo, setArquivo] = useState(null);
  const [categoria, setCategoria] = useState('escolar');
  const [descricao, setDescricao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState('');

  function carregar() {
    api.listarDocumentos(alunoId).then(setDocumentos).catch((e) => setErro(e.message));
  }
  useEffect(carregar, [alunoId]);

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    if (!arquivo) { setErro('Escolha um arquivo (PDF ou imagem).'); return; }
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append('arquivo', arquivo);
      fd.append('categoria', categoria);
      if (descricao) fd.append('descricao', descricao);
      await api.enviarDocumento(alunoId, fd);
      setArquivo(null);
      setDescricao('');
      e.target.reset?.();
      carregar();
    } catch (err) { setErro(err.message); }
    finally { setEnviando(false); }
  }

  async function remover(id) {
    if (!confirm('Remover este documento?')) return;
    try {
      await api.removerDocumento(id);
      carregar();
    } catch (err) { setErro(err.message); }
  }

  const visiveis = filtro ? documentos.filter((d) => d.categoria === filtro) : documentos;

  return (
    <div className="eixo-secao">
      {erro && <p className="alerta-erro" role="alert">{erro}</p>}

      {podeGerenciar && (
        <form className="card form" onSubmit={enviar}>
          <h3>Enviar documento</h3>
          <div className="eixo-grid">
            <div className="campo">
              <label htmlFor="doc-arquivo">Arquivo (PDF, imagem ou texto)</label>
              <input id="doc-arquivo" type="file" accept=".pdf,image/*,.doc,.docx,.odt,.txt"
                onChange={(e) => setArquivo(e.target.files?.[0] || null)} />
            </div>
            <div className="campo">
              <label htmlFor="doc-categoria">Categoria</label>
              <select id="doc-categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>{ROTULOS.categoriaDocumento[c]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="campo">
            <label htmlFor="doc-descricao">Descrição</label>
            <input id="doc-descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <button className="btn btn--primario" type="submit" disabled={enviando}>
            {enviando ? 'Enviando…' : 'Enviar documento'}
          </button>
        </form>
      )}

      <div className="card">
        <div className="doc-cabecalho">
          <h3>Documentos</h3>
          <label className="doc-filtro">
            Categoria
            <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
              <option value="">Todas</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>{ROTULOS.categoriaDocumento[c]}</option>
              ))}
            </select>
          </label>
        </div>

        {visiveis.length === 0 ? (
          <p className="vazio">Nenhum documento{filtro ? ' nesta categoria' : ''}.</p>
        ) : (
          <ul className="doc-lista" role="list">
            {visiveis.map((d) => (
              <li key={d.id} className="doc-item">
                <span className={`badge badge--doc-${d.categoria}`}>
                  {ROTULOS.categoriaDocumento[d.categoria] || d.categoria}
                </span>
                <a className="doc-nome" href={d.arquivo} target="_blank" rel="noreferrer">
                  {d.descricao || d.nome_original || 'Documento'}
                </a>
                <span className="doc-meta">{(d.criado_em || '').slice(0, 10)}{d.autor_nome ? ` · ${d.autor_nome}` : ''}</span>
                {podeGerenciar && (
                  <button className="btn btn--pequeno btn--perigo" onClick={() => remover(d.id)}>
                    Remover
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
