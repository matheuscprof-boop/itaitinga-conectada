// Gestão de escolas (acesso restrito à Secretaria Municipal).
import { useEffect, useState } from 'react';
import { api } from '../api.js';

const FORM_VAZIO = { nome: '', municipio: '', endereco: '', latitude: '', longitude: '' };

export default function Escolas() {
  const [escolas, setEscolas] = useState([]);
  const [form, setForm] = useState(FORM_VAZIO);
  const [editandoId, setEditandoId] = useState(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [salvando, setSalvando] = useState(false);

  const editando = editandoId !== null;

  async function carregar() {
    try {
      setEscolas(await api.listarEscolas());
    } catch (e) {
      setErro(e.message);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  function alterar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  function iniciarEdicao(e) {
    setEditandoId(e.id);
    setForm({
      nome: e.nome, municipio: e.municipio || '', endereco: e.endereco || '',
      latitude: e.latitude ?? '', longitude: e.longitude ?? '',
    });
    setErro('');
    setAviso('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelar() {
    setEditandoId(null);
    setForm(FORM_VAZIO);
    setErro('');
  }

  async function salvar(ev) {
    ev.preventDefault();
    setErro('');
    setAviso('');
    setSalvando(true);
    try {
      if (editando) {
        await api.atualizarEscola(editandoId, form);
        setAviso(`Escola "${form.nome}" atualizada.`);
      } else {
        await api.criarEscola(form);
        setAviso(`Escola "${form.nome}" criada.`);
      }
      cancelar();
      carregar();
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function remover(escola) {
    if (!confirm(`Remover a escola "${escola.nome}"? Alunos e usuários ficarão sem escola.`)) return;
    setErro('');
    setAviso('');
    try {
      await api.removerEscola(escola.id);
      if (editandoId === escola.id) cancelar();
      carregar();
    } catch (err) {
      setErro(err.message);
    }
  }

  return (
    <div className="painel">
      <h2>Escolas</h2>

      {erro && <p className="alerta-erro" role="alert">{erro}</p>}
      {aviso && <p className="alerta-sucesso" role="status">{aviso}</p>}

      <form className="card form" onSubmit={salvar} aria-labelledby="titulo-form-escola">
        <h3 id="titulo-form-escola">{editando ? 'Editar escola' : 'Nova escola'}</h3>
        <div className="form-grid">
          <div className="campo">
            <label htmlFor="e-nome">Nome <span aria-hidden="true">*</span></label>
            <input id="e-nome" type="text" required value={form.nome}
              onChange={(e) => alterar('nome', e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="e-municipio">Município</label>
            <input id="e-municipio" type="text" value={form.municipio}
              onChange={(e) => alterar('municipio', e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="e-endereco">Endereço</label>
            <input id="e-endereco" type="text" value={form.endereco}
              onChange={(e) => alterar('endereco', e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="e-lat">Latitude</label>
            <input id="e-lat" type="number" step="any" placeholder="-23.55" value={form.latitude}
              onChange={(e) => alterar('latitude', e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="e-lng">Longitude</label>
            <input id="e-lng" type="number" step="any" placeholder="-46.63" value={form.longitude}
              onChange={(e) => alterar('longitude', e.target.value)} />
          </div>
        </div>
        <div className="form-acoes">
          <button type="submit" className="btn btn--primario" disabled={salvando}>
            {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Criar escola'}
          </button>
          {editando && (
            <button type="button" className="btn" onClick={cancelar}>Cancelar</button>
          )}
        </div>
      </form>

      <section aria-labelledby="titulo-lista-escolas">
        <h3 id="titulo-lista-escolas">Escolas cadastradas</h3>
        {escolas.length === 0 ? (
          <p className="vazio">Nenhuma escola cadastrada.</p>
        ) : (
          <ul className="lista" role="list">
            {escolas.map((e) => (
              <li key={e.id} className="lista-item-info">
                <div>
                  <strong>{e.nome}</strong>
                  <span className="lista-item-sub">
                    {e.municipio || 'Município não informado'}
                    {e.latitude != null && e.longitude != null
                      ? ` · ${e.latitude}, ${e.longitude}`
                      : ' · sem coordenadas'}
                  </span>
                </div>
                <div className="usuario-acoes">
                  <button className="btn btn--pequeno" onClick={() => iniciarEdicao(e)}>Editar</button>
                  <button className="btn btn--pequeno btn--perigo" onClick={() => remover(e)}>Remover</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
