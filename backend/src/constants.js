// Valores de referência compartilhados pela API.
// Os "eixos" são as dimensões pedagógicas que o sistema acompanha.

export const EIXOS = ['frequencia', 'desempenho', 'socioemocional'];
export const NIVEIS = ['baixo', 'medio', 'alto'];
export const STATUS = ['aberto', 'em_andamento', 'resolvido'];

// Categoria opcional do alerta do estudante — tipifica situações de violência e
// discriminação (mais comuns no eixo Socioemocional, mas disponível em qualquer
// eixo). Sem CHECK no banco: a lista pode crescer sem reconstruir a tabela.
export const CATEGORIAS_ALERTA = [
  'bullying', 'racismo', 'misoginia', 'lgbtfobia', 'homofobia', 'capacitismo',
  'xenofobia', 'intolerancia_religiosa', 'violencia', 'outro',
];
export const CATEGORIAS_ALERTA_LABEL = {
  bullying: 'Bullying',
  racismo: 'Racismo',
  misoginia: 'Misoginia',
  lgbtfobia: 'LGBTfobia',
  homofobia: 'Homofobia',
  capacitismo: 'Capacitismo',
  xenofobia: 'Xenofobia',
  intolerancia_religiosa: 'Intolerância religiosa',
  violencia: 'Violência',
  outro: 'Outro',
};
export const PERFIS = ['professor', 'coordenacao', 'direcao', 'secretaria', 'secretaria_escolar', 'cidadao'];

// Sexo do aluno (opcional). Usado para exibir campos específicos — ex.: a marcação
// de gravidez/histórico gestacional só aparece para alunas do sexo feminino.
export const SEXOS = ['feminino', 'masculino', 'outro'];
export const SEXOS_LABEL = {
  feminino: 'Feminino',
  masculino: 'Masculino',
  outro: 'Outro',
};

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
  secretaria_escolar: 'Secretaria Escolar',
  cidadao: 'Cidadão Itaitinguense',
};

// Perfis que gerenciam alunos e removem alertas (dentro do seu escopo).
// 'secretaria_escolar' mexe com dados de aluno no escopo da própria escola.
export const PERFIS_GESTAO = ['coordenacao', 'direcao', 'secretaria', 'secretaria_escolar'];

// Perfis que administram usuários (criam/aprovam contas).
export const PERFIS_ADMIN_USUARIOS = ['direcao', 'secretaria'];

// Perfil com visão municipal (todas as escolas).
export const PERFIL_MUNICIPAL = 'secretaria';

// Perfis de equipe (com acesso a dados de aluno). Cidadão fica de fora.
// São também os perfis "privilegiados": nascem pendentes de aprovação no
// autocadastro (não basta verificar o e-mail — precisam ser aprovados).
export const PERFIS_EQUIPE = ['professor', 'coordenacao', 'direcao', 'secretaria', 'secretaria_escolar'];

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

// Vacinas comuns do calendário do adolescente (checklist da aba Saúde).
export const VACINAS = [
  'hpv', 'hepatite_b', 'triplice_viral', 'dt_dtpa', 'febre_amarela', 'meningococica', 'covid19',
];
export const VACINAS_LABEL = {
  hpv: 'HPV',
  hepatite_b: 'Hepatite B',
  triplice_viral: 'Tríplice viral (sarampo/caxumba/rubéola)',
  dt_dtpa: 'dT/dTpa (difteria e tétano)',
  febre_amarela: 'Febre amarela',
  meningococica: 'Meningocócica ACWY',
  covid19: 'COVID-19',
};

// Doenças/condições pré-existentes (checklist da aba Saúde). "Outros" é campo
// de texto livre à parte (doencas_outros).
export const DOENCAS_PREEXISTENTES = [
  'diabetes', 'hipertensao', 'asma', 'epilepsia', 'cardiopatia', 'anemia_falciforme',
  'obesidade', 'doenca_renal', 'rinite', 'tdah', 'tea',
];
export const DOENCAS_PREEXISTENTES_LABEL = {
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
};

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
