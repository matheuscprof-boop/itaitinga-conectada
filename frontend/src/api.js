// Camada fina de acesso à API. Centraliza as chamadas fetch, o token de
// autenticação e o tratamento de erro, para que os componentes não precisem
// conhecer as URLs.

const BASE = '/api';
const CHAVE_TOKEN = 'saae_token';

// --- Gestão do token (persistido no navegador) ---
export function getToken() {
  return localStorage.getItem(CHAVE_TOKEN);
}
function setToken(token) {
  if (token) localStorage.setItem(CHAVE_TOKEN, token);
}
export function limparToken() {
  localStorage.removeItem(CHAVE_TOKEN);
}

function cabecalhos(extra = {}) {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

// Erro específico de sessão inválida/expirada (permite tratamento na UI).
export class NaoAutorizado extends Error {}

async function tratarResposta(resp) {
  if (resp.status === 401) {
    limparToken();
    // Avisa a aplicação para voltar à tela de login (tratado no App).
    window.dispatchEvent(new Event('saae:sessao-expirada'));
    throw new NaoAutorizado('Sessão expirada. Faça login novamente.');
  }
  if (resp.status === 204) return null; // sem conteúdo (ex.: DELETE)

  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const erro = new Error(dados.erro || 'Ocorreu um erro na requisição.');
    erro.motivo = dados.motivo; // ex.: 'email_nao_verificado' | 'pendente'
    erro.email = dados.email;
    erro.status = resp.status;
    throw erro;
  }
  return dados;
}

async function requisicao(caminho, opcoes = {}) {
  const resp = await fetch(BASE + caminho, { headers: cabecalhos(), ...opcoes });
  return tratarResposta(resp);
}

// Requisição com FormData (upload de imagem). Não define Content-Type: o
// navegador monta o boundary de multipart automaticamente.
async function requisicaoForm(caminho, formData, method = 'POST') {
  const token = getToken();
  const resp = await fetch(BASE + caminho, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  return tratarResposta(resp);
}

export const api = {
  // --- Autenticação ---
  login: async (email, senha) => {
    const dados = await requisicao('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, senha }),
    });
    setToken(dados.token);
    return dados.usuario;
  },
  eu: () => requisicao('/auth/me'),
  logout: () => limparToken(),

  // Autocadastro público. Todos verificam o e-mail; perfis privilegiados
  // ainda ficam pendentes de aprovação.
  registrar: (dados) =>
    requisicao('/auth/registro', { method: 'POST', body: JSON.stringify(dados) }),
  verificarEmail: (email, codigo) =>
    requisicao('/auth/verificar-email', { method: 'POST', body: JSON.stringify({ email, codigo }) }),
  reenviarCodigo: (email) =>
    requisicao('/auth/reenviar-codigo', { method: 'POST', body: JSON.stringify({ email }) }),
  // Lista pública mínima de escolas (para o formulário de cadastro)
  listarEscolasPublicas: () => requisicao('/escolas-publicas'),

  // Troca da própria senha
  trocarSenha: (senha_atual, nova_senha) =>
    requisicao('/auth/senha', { method: 'PATCH', body: JSON.stringify({ senha_atual, nova_senha }) }),

  // Gestão de usuários (somente direção)
  listarUsuarios: () => requisicao('/auth/usuarios'),
  // Contas aguardando aprovação + aprovação (direção/secretaria).
  listarPendentes: () => requisicao('/auth/usuarios/pendentes'),
  aprovarUsuario: (id) => requisicao(`/auth/usuarios/${id}/aprovar`, { method: 'PATCH' }),
  criarUsuario: (dados) =>
    requisicao('/auth/usuarios', { method: 'POST', body: JSON.stringify(dados) }),
  atualizarUsuario: (id, dados) =>
    requisicao(`/auth/usuarios/${id}`, { method: 'PUT', body: JSON.stringify(dados) }),
  removerUsuario: (id) => requisicao(`/auth/usuarios/${id}`, { method: 'DELETE' }),
  // Turmas de responsabilidade de um professor (direcionam as notificações).
  listarTurmasProfessor: (id) => requisicao(`/auth/usuarios/${id}/turmas`),
  salvarTurmasProfessor: (id, turmas) =>
    requisicao(`/auth/usuarios/${id}/turmas`, { method: 'PUT', body: JSON.stringify({ turmas }) }),

  // Notificações (perfis de gestão)
  listarNotificacoes: (apenasNaoLidas = false) =>
    requisicao(`/notificacoes${apenasNaoLidas ? '?nao_lidas=1' : ''}`),
  marcarNotificacaoLida: (id) => requisicao(`/notificacoes/${id}`, { method: 'PATCH' }),
  marcarTodasNotificacoesLidas: () =>
    requisicao('/notificacoes/marcar-todas-lidas', { method: 'POST' }),

  // --- Referências ---
  referencias: () => requisicao('/referencias'),
  listarTurmas: () => requisicao('/alunos/turmas'),

  // --- Escolas ---
  listarEscolas: () => requisicao('/escolas'),
  obterEscola: (id) => requisicao(`/escolas/${id}`),
  criarEscola: (dados) => requisicao('/escolas', { method: 'POST', body: JSON.stringify(dados) }),
  atualizarEscola: (id, dados) =>
    requisicao(`/escolas/${id}`, { method: 'PUT', body: JSON.stringify(dados) }),
  removerEscola: (id) => requisicao(`/escolas/${id}`, { method: 'DELETE' }),

  // --- Alunos ---
  listarAlunos: (q = '') => requisicao(`/alunos${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  obterAluno: (id) => requisicao(`/alunos/${id}`),
  criarAluno: (dados) => requisicao('/alunos', { method: 'POST', body: JSON.stringify(dados) }),
  atualizarAluno: (id, dados) =>
    requisicao(`/alunos/${id}`, { method: 'PUT', body: JSON.stringify(dados) }),
  removerAluno: (id) => requisicao(`/alunos/${id}`, { method: 'DELETE' }),

  // --- Alertas ---
  listarAlertas: (filtros = {}) => {
    const qs = new URLSearchParams(limparVazios(filtros)).toString();
    return requisicao(`/alertas${qs ? `?${qs}` : ''}`);
  },
  resumoAlertas: () => requisicao('/alertas/resumo'),
  criarAlerta: (dados) => requisicao('/alertas', { method: 'POST', body: JSON.stringify(dados) }),
  atualizarStatusAlerta: (id, status) =>
    requisicao(`/alertas/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  removerAlerta: (id) => requisicao(`/alertas/${id}`, { method: 'DELETE' }),

  // --- Eixo A: Saúde ---
  obterSaude: (alunoId) => requisicao(`/saude/${alunoId}`),
  salvarSaude: (alunoId, dados) =>
    requisicao(`/saude/${alunoId}`, { method: 'PUT', body: JSON.stringify(dados) }),
  registrarSintoma: (alunoId, dados) =>
    requisicao(`/saude/${alunoId}/sintomas`, { method: 'POST', body: JSON.stringify(dados) }),
  // Anexos de saúde (carteira de vacina / receita médica) — multipart, campo "arquivo".
  enviarCartaoVacina: (alunoId, formData) =>
    requisicaoForm(`/saude/${alunoId}/cartao-vacina`, formData, 'POST'),
  removerCartaoVacina: (alunoId) =>
    requisicao(`/saude/${alunoId}/cartao-vacina`, { method: 'DELETE' }),
  enviarReceita: (alunoId, formData) =>
    requisicaoForm(`/saude/${alunoId}/receita`, formData, 'POST'),
  removerReceita: (alunoId) =>
    requisicao(`/saude/${alunoId}/receita`, { method: 'DELETE' }),

  // --- Eixo B: Assistência Social ---
  obterAssistencia: (alunoId) => requisicao(`/assistencia/${alunoId}`),
  salvarAssistencia: (alunoId, dados) =>
    requisicao(`/assistencia/${alunoId}`, { method: 'PUT', body: JSON.stringify(dados) }),
  listarAreasRisco: () => requisicao('/assistencia/areas/risco'),
  // Geocodifica um endereço (endereço → { latitude, longitude, endereco_encontrado }).
  geocodificar: (endereco) =>
    requisicao(`/geo/geocodificar?endereco=${encodeURIComponent(endereco)}`),

  // --- Eixo C: Vida Escolar + Diário de Bordo ---
  obterVidaEscolar: (alunoId) => requisicao(`/vida-escolar/${alunoId}`),
  salvarVidaEscolar: (alunoId, dados) =>
    requisicao(`/vida-escolar/${alunoId}`, { method: 'PUT', body: JSON.stringify(dados) }),
  enviarFotoLogbook: (alunoId, formData) =>
    requisicaoForm(`/vida-escolar/${alunoId}/fotos`, formData, 'POST'),
  removerFotoLogbook: (fotoId) =>
    requisicao(`/vida-escolar/fotos/${fotoId}`, { method: 'DELETE' }),

  // --- Documentos do aluno ---
  listarDocumentos: (alunoId) => requisicao(`/documentos/${alunoId}`),
  enviarDocumento: (alunoId, formData) =>
    requisicaoForm(`/documentos/${alunoId}`, formData, 'POST'),
  removerDocumento: (docId) => requisicao(`/documentos/${docId}`, { method: 'DELETE' }),

  // --- Eixo D: Infraestrutura (cidadania) ---
  infraListarAlertas: (filtros = {}) => {
    const qs = new URLSearchParams(limparVazios(filtros)).toString();
    return requisicao(`/infra/alertas${qs ? `?${qs}` : ''}`);
  },
  infraObterAlerta: (id) => requisicao(`/infra/alertas/${id}`),
  infraCriarAlerta: (formData) => requisicaoForm('/infra/alertas', formData, 'POST'),
  infraAtualizarStatus: (id, status) =>
    requisicao(`/infra/alertas/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // --- Histórico (linha do tempo) ---
  listarHistorico: (alertaId) => requisicao(`/alertas/${alertaId}/historico`),
  comentar: (alertaId, texto) =>
    requisicao(`/alertas/${alertaId}/historico`, { method: 'POST', body: JSON.stringify({ texto }) }),

  // --- Relatórios ---
  resumoRelatorio: (filtros = {}) => {
    const qs = new URLSearchParams(limparVazios(filtros)).toString();
    return requisicao(`/relatorios/resumo${qs ? `?${qs}` : ''}`);
  },
  // Painel analítico: série (agrupada por uma dimensão) e matriz (cruzamento).
  serieRelatorio: (dimensao, filtros = {}) => {
    const qs = new URLSearchParams(limparVazios({ ...filtros, dimensao })).toString();
    return requisicao(`/relatorios/serie?${qs}`);
  },
  matrizRelatorio: (linha, coluna, filtros = {}) => {
    const qs = new URLSearchParams(limparVazios({ ...filtros, linha, coluna })).toString();
    return requisicao(`/relatorios/matriz?${qs}`);
  },
  mapaRelatorio: (filtros = {}) => {
    const qs = new URLSearchParams(limparVazios(filtros)).toString();
    return requisicao(`/relatorios/mapa${qs ? `?${qs}` : ''}`);
  },

  // Exporta CSV respeitando o token: baixa como blob e dispara o download.
  baixarCsv: async (filtros = {}) => {
    const qs = new URLSearchParams(limparVazios(filtros)).toString();
    const resp = await fetch(`${BASE}/relatorios/alertas.csv${qs ? `?${qs}` : ''}`, {
      headers: cabecalhos(),
    });
    if (!resp.ok) throw new Error('Não foi possível exportar o CSV.');
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'alertas.csv';
    link.click();
    URL.revokeObjectURL(url);
  },
};

// Remove chaves com valor vazio antes de montar a query string.
function limparVazios(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v != null));
}

// Rótulos legíveis reutilizados pela interface.
export const ROTULOS = {
  eixo: { frequencia: 'Frequência', desempenho: 'Desempenho', socioemocional: 'Socioemocional' },
  nivel: { baixo: 'Baixo', medio: 'Médio', alto: 'Alto' },
  status: { aberto: 'Aberto', em_andamento: 'Em andamento', resolvido: 'Resolvido' },
  perfil: {
    professor: 'Professor(a)',
    coordenacao: 'Coordenação',
    direcao: 'Direção',
    secretaria: 'Secretaria Municipal',
    secretaria_escolar: 'Secretaria Escolar',
    cidadao: 'Cidadão Itaitinguense',
  },
  categoriaInfra: {
    iluminacao: 'Iluminação',
    buraco: 'Buraco na via',
    lixo: 'Lixo',
    saneamento: 'Saneamento',
    alagamento: 'Alagamento',
    outro: 'Outro',
  },
  vacinacao: { em_dia: 'Em dia', pendente: 'Pendente' },
  categoriaDocumento: { saude: 'Saúde', social: 'Social', escolar: 'Escolar', outro: 'Outro' },
  // Checklist de vacinas do calendário do adolescente (mesma ordem do backend).
  vacinas: {
    hpv: 'HPV',
    hepatite_b: 'Hepatite B',
    triplice_viral: 'Tríplice viral (sarampo/caxumba/rubéola)',
    dt_dtpa: 'dT/dTpa (difteria e tétano)',
    febre_amarela: 'Febre amarela',
    meningococica: 'Meningocócica ACWY',
    covid19: 'COVID-19',
  },
  // Checklist de doenças/condições pré-existentes.
  doencas: {
    diabetes: 'Diabetes',
    hipertensao: 'Pressão alta (hipertensão)',
    asma: 'Asma',
    epilepsia: 'Epilepsia (convulsões)',
    cardiopatia: 'Doença cardíaca (cardiopatia)',
    anemia_falciforme: 'Anemia falciforme',
    obesidade: 'Obesidade',
    doenca_renal: 'Doença renal crônica',
    rinite: 'Rinite alérgica',
    tdah: 'TDAH',
    tea: 'Autismo (TEA)',
  },
};

// Emoji de cada categoria de problema de infraestrutura (usado nos botões,
// selos e marcadores do mapa).
export const EMOJI_INFRA = {
  iluminacao: '💡',
  buraco: '🕳️',
  lixo: '🗑️',
  saneamento: '🚰',
  alagamento: '🌊',
  outro: '📌',
};

// Rótulo com emoji: "🌊 Alagamento".
export function rotuloInfra(categoria) {
  return `${EMOJI_INFRA[categoria] || ''} ${ROTULOS.categoriaInfra[categoria] || categoria}`.trim();
}

// Perfis que podem gerenciar alunos e remover alertas.
export function podeGerenciar(perfil) {
  return (
    perfil === 'coordenacao' ||
    perfil === 'direcao' ||
    perfil === 'secretaria' ||
    perfil === 'secretaria_escolar'
  );
}

// Perfil com visão municipal (todas as escolas).
export function ehSecretaria(perfil) {
  return perfil === 'secretaria';
}

// Perfil de cidadão (eixo de infraestrutura; sem acesso a dados de aluno).
export function ehCidadao(perfil) {
  return perfil === 'cidadao';
}
