// Valores de referência compartilhados pela API.
// Os "eixos" são as dimensões pedagógicas que o sistema acompanha.

export const EIXOS = ['frequencia', 'desempenho', 'socioemocional'];
export const NIVEIS = ['baixo', 'medio', 'alto'];
export const STATUS = ['aberto', 'em_andamento', 'resolvido'];
export const PERFIS = ['professor', 'coordenacao', 'direcao', 'secretaria', 'cidadao'];

// Rótulos legíveis (usados também como referência pelo frontend).
export const EIXOS_LABEL = {
  frequencia: 'Frequência',
  desempenho: 'Desempenho',
  socioemocional: 'Socioemocional',
};

export const PERFIS_LABEL = {
  professor: 'Professor(a)',
  coordenacao: 'Coordenação',
  direcao: 'Direção',
  secretaria: 'Secretaria Municipal',
  cidadao: 'Cidadão Itaitinguense',
};

// Perfis que gerenciam alunos e removem alertas (dentro do seu escopo).
export const PERFIS_GESTAO = ['coordenacao', 'direcao', 'secretaria'];

// Perfis que administram usuários.
export const PERFIS_ADMIN_USUARIOS = ['direcao', 'secretaria'];

// Perfil com visão municipal (todas as escolas).
export const PERFIL_MUNICIPAL = 'secretaria';

// Perfis de equipe (com acesso a dados de aluno). Cidadão fica de fora.
export const PERFIS_EQUIPE = ['professor', 'coordenacao', 'direcao', 'secretaria'];

// Perfil de cidadão (eixo D — infraestrutura/cidadania; sem acesso a alunos).
export const PERFIL_CIDADAO = 'cidadao';

// Situação da conta.
export const STATUS_CONTA = ['ativo', 'pendente'];

// --- Eixo D — Infraestrutura ---
export const CATEGORIAS_INFRA = ['iluminacao', 'buraco', 'lixo', 'saneamento', 'alagamento', 'outro'];
export const CATEGORIAS_INFRA_LABEL = {
  iluminacao: 'Iluminação',
  buraco: 'Buraco na via',
  lixo: 'Lixo',
  saneamento: 'Saneamento',
  alagamento: 'Alagamento',
  outro: 'Outro',
};
export const STATUS_INFRA = ['aberto', 'em_andamento', 'resolvido'];

// --- Eixo A — Saúde ---
export const VACINACAO_STATUS = ['em_dia', 'pendente'];

// --- Documentos do aluno ---
export const CATEGORIAS_DOCUMENTO = ['saude', 'social', 'escolar', 'outro'];
export const CATEGORIAS_DOCUMENTO_LABEL = {
  saude: 'Saúde',
  social: 'Social',
  escolar: 'Escolar',
  outro: 'Outro',
};

// Limite (nº de alunos com sintoma semelhante na mesma turma em 24h) que
// dispara o alerta automático de saúde. Configurável por variável de ambiente.
export const LIMITE_SINTOMAS = Number(process.env.SAAE_LIMITE_SINTOMAS) || 3;
