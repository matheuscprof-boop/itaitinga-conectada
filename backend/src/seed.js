// Popula o banco com dados de exemplo para demonstração.
// Uso:  npm run seed   (dentro da pasta backend)
// Atenção: limpa escolas/alunos/alertas/histórico/notificações antes de
// inserir. Usuários são preservados (o admin da secretaria é criado pelo
// bootstrap).

import db from './db.js';
import { garantirAdminPadrao } from './bootstrap.js';
import { gerarHashSenha } from './senha.js';

garantirAdminPadrao();

// --- Escolas (coordenadas na região de Itaitinga/CE para o mapa) ---
const escolas = [
  { nome: 'EMEF Jardim das Flores', municipio: 'Itaitinga', endereco: 'Rua das Acácias, 100', latitude: -3.9700, longitude: -38.5250 },
  { nome: 'EMEF Vila Nova',         municipio: 'Itaitinga', endereco: 'Av. Central, 500',      latitude: -3.9950, longitude: -38.5600 },
  { nome: 'EMEF Parque Verde',      municipio: 'Itaitinga', endereco: 'Rua do Bosque, 42',     latitude: -3.9450, longitude: -38.5100 },
];

// --- Usuários de exemplo (além do admin da secretaria) ---
const usuarios = [
  { nome: 'Prof. Helena Dias',   email: 'helena@saae.local', senha: 'prof123',  perfil: 'professor',   escola: 'EMEF Jardim das Flores' },
  { nome: 'Coord. Marcos Reis',  email: 'marcos@saae.local', senha: 'coord123', perfil: 'coordenacao', escola: 'EMEF Jardim das Flores' },
  { nome: 'Dir. Joana Prado',    email: 'joana@saae.local',  senha: 'dir123',   perfil: 'direcao',     escola: 'EMEF Vila Nova' },
  { nome: 'José da Silva (Cidadão)', email: 'cidadao@itaitinga.gov', senha: 'cidadao123', perfil: 'cidadao', escola: null },
];

// --- Áreas de risco mapeadas pelo município (eixo B) ---
const areasRisco = [
  { nome: 'Baixada do Gererau', latitude: -3.9950, longitude: -38.5600, raio_km: 1.5 },
  { nome: 'Margem do córrego (Centro)', latitude: -3.9720, longitude: -38.5280, raio_km: 0.8 },
];

// --- Dados dos eixos por aluno (indexados por matrícula) ---
const saudePorAluno = {
  '2025001': { vacinacao_status: 'em_dia',   vacinas: 'Tríplice viral, HPV', alergias: 'Amendoim' },
  '2025002': { vacinacao_status: 'pendente', vacinas: 'Pendente reforço dT', alergias: null },
  '2025003': { vacinacao_status: 'em_dia',   vacinas: 'Em dia',              alergias: 'Poeira, ácaros' },
  '2025004': { vacinacao_status: 'pendente', vacinas: null,                  alergias: null },
};

// Sintomas recentes concentrados na turma 9º A (demonstra o alerta de surto).
const sintomas = [
  { aluno: '2025001', sintomas: 'febre, tosse', observacao: 'Enviada à enfermaria.' },
  { aluno: '2025002', sintomas: 'febre, dor de cabeça', observacao: null },
];

const assistenciaPorAluno = {
  '2025001': { bolsa_familia: 1, programas: 'Bolsa Família', composicao_familiar: 'Mãe e 2 irmãos', latitude: -3.9705, longitude: -38.5255 },
  '2025003': { bolsa_familia: 1, programas: 'Bolsa Família, BPC', composicao_familiar: 'Avó responsável', latitude: -3.9955, longitude: -38.5605 }, // dentro de área de risco
  '2025004': { bolsa_familia: 0, programas: null, composicao_familiar: 'Pais e 1 irmão', latitude: -3.9450, longitude: -38.5100 },
};

const vidaEscolarPorAluno = {
  '2025001': { frequencia_percentual: 94.0, desempenho_media: 7.8, projetos: 'Guardiões dos Biomas', observacoes: 'Lidera o grupo de horta.' },
  '2025002': { frequencia_percentual: 88.5, desempenho_media: 6.2, projetos: null, observacoes: null },
  '2025003': { frequencia_percentual: 72.0, desempenho_media: 5.5, projetos: 'Feira de Ciências', observacoes: 'Acompanhar frequência.' },
  '2025004': { frequencia_percentual: 90.0, desempenho_media: 6.9, projetos: 'Guardiões dos Biomas', observacoes: null },
};

// --- Alertas de infraestrutura (eixo D). cidadao=email ou null (anônimo) ---
const alertasInfra = [
  { categoria: 'buraco', descricao: 'Buraco grande na Av. Central, próximo ao mercado.', latitude: -3.9948, longitude: -38.5598, anonimo: 0, cidadao: 'cidadao@itaitinga.gov', status: 'aberto' },
  { categoria: 'iluminacao', descricao: 'Poste apagado há uma semana na Rua das Acácias.', latitude: -3.9702, longitude: -38.5252, anonimo: 0, cidadao: 'cidadao@itaitinga.gov', status: 'em_andamento' },
  { categoria: 'lixo', descricao: 'Descarte irregular de entulho na esquina.', latitude: -3.9460, longitude: -38.5110, anonimo: 1, cidadao: null, status: 'aberto' },
  { categoria: 'alagamento', descricao: 'Rua alaga a cada chuva forte, próximo à ponte.', latitude: -3.9940, longitude: -38.5590, anonimo: 0, cidadao: 'cidadao@itaitinga.gov', status: 'aberto' },
];

// --- Alunos ---
const alunos = [
  { nome: 'Ana Beatriz Souza',    matricula: '2025001', turma: '9º A', escola: 'EMEF Jardim das Flores',
    data_nascimento: '2011-03-14', responsavel_nome: 'Marina Souza', responsavel_contato: '(11) 98888-1010',
    observacoes: 'Participa do reforço de matemática às terças.' },
  { nome: 'Bruno Henrique Lima',  matricula: '2025002', turma: '9º A', escola: 'EMEF Jardim das Flores',
    data_nascimento: '2010-11-02', responsavel_nome: 'Carlos Lima', responsavel_contato: 'carlos.lima@email.com',
    observacoes: null },
  { nome: 'Carla Mendes Oliveira', matricula: '2025003', turma: '8º B', escola: 'EMEF Vila Nova',
    data_nascimento: '2012-06-21', responsavel_nome: 'Patrícia Oliveira', responsavel_contato: '(11) 97777-2020',
    observacoes: 'Mudança recente de escola.' },
  { nome: 'Diego Ferreira Alves', matricula: '2025004', turma: '7º C', escola: 'EMEF Parque Verde',
    data_nascimento: '2013-01-09', responsavel_nome: 'Sônia Alves', responsavel_contato: '(11) 96666-3030',
    observacoes: null },
];

const alertas = [
  { aluno: '2025001', eixo: 'frequencia', nivel: 'medio', titulo: 'Faltas recorrentes às segundas',
    descricao: 'Três faltas nas últimas quatro segundas-feiras.', status: 'aberto' },
  { aluno: '2025001', eixo: 'desempenho', nivel: 'baixo', titulo: 'Queda leve em Ciências',
    descricao: 'Nota do último bimestre ligeiramente abaixo da média.', status: 'em_andamento' },
  { aluno: '2025002', eixo: 'socioemocional', nivel: 'alto', titulo: 'Isolamento em atividades de grupo',
    descricao: 'Relato da professora de Português sobre retraimento.', status: 'aberto' },
  { aluno: '2025003', eixo: 'frequencia', nivel: 'alto', titulo: 'Ausência prolongada',
    descricao: 'Cinco dias consecutivos sem comparecimento.', status: 'aberto' },
  { aluno: '2025004', eixo: 'desempenho', nivel: 'medio', titulo: 'Dificuldade em leitura',
    descricao: 'Acompanhamento sugerido pela professora regente.', status: 'aberto' },
];

// --- Limpeza (respeita a ordem das dependências) ---
const limpar = db.transaction(() => {
  db.prepare('DELETE FROM alertas_infra').run();
  db.prepare('DELETE FROM logbook_fotos').run();
  db.prepare('DELETE FROM saude_sintomas').run();
  db.prepare('DELETE FROM saude_aluno').run();
  db.prepare('DELETE FROM assistencia_aluno').run();
  db.prepare('DELETE FROM vida_escolar_aluno').run();
  db.prepare('DELETE FROM areas_risco').run();
  db.prepare('DELETE FROM notificacoes').run();
  db.prepare('DELETE FROM alerta_historico').run();
  db.prepare('DELETE FROM alertas').run();
  db.prepare('DELETE FROM alunos').run();
  db.prepare("UPDATE usuarios SET escola_id = NULL WHERE perfil != 'secretaria'").run(); // solta vínculos antes de apagar escolas
  db.prepare('DELETE FROM escolas').run();
  db.prepare(
    "DELETE FROM sqlite_sequence WHERE name IN ('escolas','alunos','alertas','alerta_historico','notificacoes','saude_sintomas','areas_risco','logbook_fotos','alertas_infra')"
  ).run();
});

const inserirEscola = db.prepare(`
  INSERT INTO escolas (nome, municipio, endereco, latitude, longitude)
  VALUES (@nome, @municipio, @endereco, @latitude, @longitude)
`);
const inserirUsuario = db.prepare(`
  INSERT INTO usuarios (nome, email, senha_hash, senha_salt, perfil, escola_id)
  VALUES (@nome, @email, @senha_hash, @senha_salt, @perfil, @escola_id)
  ON CONFLICT(email) DO UPDATE SET escola_id = excluded.escola_id, perfil = excluded.perfil
`);
const inserirAluno = db.prepare(`
  INSERT INTO alunos (escola_id, nome, matricula, turma, data_nascimento,
                      responsavel_nome, responsavel_contato, observacoes)
  VALUES (@escola_id, @nome, @matricula, @turma, @data_nascimento,
          @responsavel_nome, @responsavel_contato, @observacoes)
`);
const inserirAlerta = db.prepare(`
  INSERT INTO alertas (aluno_id, eixo, nivel, titulo, descricao, status)
  VALUES (@aluno_id, @eixo, @nivel, @titulo, @descricao, @status)
`);
const inserirHistorico = db.prepare(`
  INSERT INTO alerta_historico (alerta_id, tipo, texto, status_novo, autor_nome)
  VALUES (@alerta_id, 'mudanca_status', 'Alerta registrado (dados de exemplo).', 'aberto', 'Sistema')
`);
const inserirNotificacao = db.prepare(`
  INSERT INTO notificacoes (alerta_id, escola_id, aluno_nome, titulo, mensagem)
  VALUES (@alerta_id, @escola_id, @aluno_nome, @titulo, @mensagem)
`);
const idPorMatricula = db.prepare('SELECT id, escola_id FROM alunos WHERE matricula = ?');
const idUsuarioPorEmail = db.prepare('SELECT id FROM usuarios WHERE email = ?');

const inserirArea = db.prepare(`
  INSERT INTO areas_risco (nome, latitude, longitude, raio_km)
  VALUES (@nome, @latitude, @longitude, @raio_km)
`);
const inserirSaude = db.prepare(`
  INSERT INTO saude_aluno (aluno_id, vacinacao_status, vacinas, alergias)
  VALUES (@aluno_id, @vacinacao_status, @vacinas, @alergias)
`);
const inserirSintoma = db.prepare(`
  INSERT INTO saude_sintomas (aluno_id, sintomas, observacao, autor_nome)
  VALUES (@aluno_id, @sintomas, @observacao, 'Seed')
`);
const inserirAssistencia = db.prepare(`
  INSERT INTO assistencia_aluno (aluno_id, bolsa_familia, programas, composicao_familiar, latitude, longitude, em_area_risco)
  VALUES (@aluno_id, @bolsa_familia, @programas, @composicao_familiar, @latitude, @longitude, @em_area_risco)
`);
const inserirVidaEscolar = db.prepare(`
  INSERT INTO vida_escolar_aluno (aluno_id, frequencia_percentual, desempenho_media, projetos, observacoes)
  VALUES (@aluno_id, @frequencia_percentual, @desempenho_media, @projetos, @observacoes)
`);
const inserirInfra = db.prepare(`
  INSERT INTO alertas_infra (categoria, descricao, latitude, longitude, anonimo, cidadao_id, status)
  VALUES (@categoria, @descricao, @latitude, @longitude, @anonimo, @cidadao_id, @status)
`);

// Distância aproximada em km (Haversine) — usada para marcar em_area_risco.
function distanciaKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
function dentroDeAreaRisco(lat, lon) {
  if (lat == null || lon == null) return false;
  return areasRisco.some((ar) => distanciaKm(lat, lon, ar.latitude, ar.longitude) <= ar.raio_km);
}

const popular = db.transaction(() => {
  // Escolas → mapa nome → id
  const escolaId = {};
  for (const e of escolas) {
    const { lastInsertRowid } = inserirEscola.run(e);
    escolaId[e.nome] = lastInsertRowid;
  }

  // Usuários vinculados às escolas
  for (const u of usuarios) {
    const { senha_hash, senha_salt } = gerarHashSenha(u.senha);
    inserirUsuario.run({
      nome: u.nome, email: u.email, senha_hash, senha_salt,
      perfil: u.perfil, escola_id: escolaId[u.escola] ?? null,
    });
  }

  // Alunos
  for (const a of alunos) {
    inserirAluno.run({
      escola_id: escolaId[a.escola] ?? null,
      nome: a.nome, matricula: a.matricula, turma: a.turma,
      data_nascimento: a.data_nascimento, responsavel_nome: a.responsavel_nome,
      responsavel_contato: a.responsavel_contato, observacoes: a.observacoes,
    });
  }

  // Alertas + histórico inicial + notificação (para nível alto)
  for (const al of alertas) {
    const aluno = idPorMatricula.get(al.aluno);
    const { lastInsertRowid } = inserirAlerta.run({
      aluno_id: aluno.id, eixo: al.eixo, nivel: al.nivel,
      titulo: al.titulo, descricao: al.descricao, status: al.status,
    });
    inserirHistorico.run({ alerta_id: lastInsertRowid });
    if (al.nivel === 'alto') {
      const nomeAluno = alunos.find((x) => x.matricula === al.aluno)?.nome;
      inserirNotificacao.run({
        alerta_id: lastInsertRowid, escola_id: aluno.escola_id, aluno_nome: nomeAluno,
        titulo: `Alerta de nível ALTO: ${al.titulo}`,
        mensagem: `Aluno(a): ${nomeAluno} · Eixo: ${al.eixo}. ${al.descricao || ''}`.trim(),
      });
    }
  }

  // Áreas de risco (eixo B)
  for (const ar of areasRisco) inserirArea.run(ar);

  // Dados dos eixos por aluno (Saúde / Assistência / Vida Escolar)
  for (const [matricula, s] of Object.entries(saudePorAluno)) {
    const aluno = idPorMatricula.get(matricula);
    if (aluno) inserirSaude.run({ aluno_id: aluno.id, ...s });
  }
  for (const s of sintomas) {
    const aluno = idPorMatricula.get(s.aluno);
    if (aluno) inserirSintoma.run({ aluno_id: aluno.id, sintomas: s.sintomas, observacao: s.observacao });
  }
  for (const [matricula, a] of Object.entries(assistenciaPorAluno)) {
    const aluno = idPorMatricula.get(matricula);
    if (aluno) {
      inserirAssistencia.run({
        aluno_id: aluno.id, bolsa_familia: a.bolsa_familia, programas: a.programas,
        composicao_familiar: a.composicao_familiar, latitude: a.latitude, longitude: a.longitude,
        em_area_risco: dentroDeAreaRisco(a.latitude, a.longitude) ? 1 : 0,
      });
    }
  }
  for (const [matricula, v] of Object.entries(vidaEscolarPorAluno)) {
    const aluno = idPorMatricula.get(matricula);
    if (aluno) inserirVidaEscolar.run({ aluno_id: aluno.id, ...v });
  }

  // Alertas de infraestrutura (eixo D)
  for (const inf of alertasInfra) {
    const cidadaoId = inf.cidadao ? idUsuarioPorEmail.get(inf.cidadao)?.id ?? null : null;
    inserirInfra.run({
      categoria: inf.categoria, descricao: inf.descricao, latitude: inf.latitude,
      longitude: inf.longitude, anonimo: inf.anonimo, cidadao_id: cidadaoId, status: inf.status,
    });
  }
});

limpar();
popular();

console.log(
  `Seed concluído: ${escolas.length} escolas, ${usuarios.length} usuários, ${alunos.length} alunos, ` +
  `${alertas.length} alertas, ${areasRisco.length} áreas de risco e ${alertasInfra.length} alertas de infraestrutura.`
);
