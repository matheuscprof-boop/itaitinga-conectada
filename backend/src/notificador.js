// Serviço de notificações da equipe de gestão.
//
// Cada notificação é registrada no banco e exibida no feed interno
// (/api/notificacoes). Além disso, quando o envio por SMTP está configurado
// (ver src/email.js), a notificação também é enviada por E-MAIL à gestão
// responsável. Sem SMTP configurado, o e-mail é simplesmente ignorado — o feed
// interno continua funcionando normalmente.

import db from './db.js';
import { enviarEmail, emailConfigurado } from './email.js';

const inserir = db.prepare(`
  INSERT INTO notificacoes (alerta_id, escola_id, aluno_nome, titulo, mensagem)
  VALUES (@alerta_id, @escola_id, @aluno_nome, @titulo, @mensagem)
`);

// Destinatários por e-mail de uma notificação (espelha o escopo do feed em
// /api/notificacoes e acrescenta o professor responsável pela turma):
//   - Secretaria (visão municipal) SEMPRE recebe.
//   - Coordenação e Direção da escola relacionada recebem (quando há escola).
//   - Professor(es) responsáveis pela TURMA do aluno recebem (quando há turma).
//     Obs.: o professor recebe apenas o e-mail; o feed interno segue restrito à
//     gestão (a rota /api/notificacoes é protegida por perfil de gestão).
const secretarias = db.prepare(
  "SELECT nome, email FROM usuarios WHERE perfil = 'secretaria' AND email IS NOT NULL AND email <> ''"
);
const gestaoDaEscola = db.prepare(
  `SELECT nome, email FROM usuarios
   WHERE perfil IN ('coordenacao', 'direcao') AND escola_id = ?
     AND email IS NOT NULL AND email <> ''`
);
const professoresDaTurma = db.prepare(
  `SELECT u.nome, u.email
   FROM professor_turmas pt
   JOIN usuarios u ON u.id = pt.professor_id
   WHERE pt.turma = @turma AND u.escola_id = @escola AND u.perfil = 'professor'
     AND u.email IS NOT NULL AND u.email <> ''`
);

function destinatarios(escolaId, turma) {
  const porEmail = new Map();
  for (const u of secretarias.all()) porEmail.set(u.email, u);
  if (escolaId != null) {
    for (const u of gestaoDaEscola.all(escolaId)) porEmail.set(u.email, u);
    if (turma) {
      for (const u of professoresDaTurma.all({ turma, escola: escolaId })) porEmail.set(u.email, u);
    }
  }
  return [...porEmail.values()];
}

// Gera uma notificação para um alerta de nível alto. `turma` direciona o e-mail
// ao professor responsável, além da gestão.
export function notificarAlertaAlto(alerta, alunoNome, escolaId = null, turma = null) {
  const titulo = `Alerta de nível ALTO: ${alerta.titulo}`;
  const mensagem =
    `Aluno(a): ${alunoNome || '—'} · Eixo: ${alerta.eixo}.` +
    (alerta.descricao ? ` ${alerta.descricao}` : '');

  notificar({ titulo, mensagem, escolaId, turma, alertaId: alerta.id, alunoNome });
}

// Notificação genérica para a equipe de gestão (usada também pelos alertas
// automáticos dos eixos de Saúde e Assistência). `escolaId` define o escopo e
// `turma` (opcional) inclui o professor responsável nos e-mails.
export function notificar({ titulo, mensagem, escolaId = null, turma = null, alertaId = null, alunoNome = null }) {
  inserir.run({
    alerta_id: alertaId ?? null,
    escola_id: escolaId ?? null,
    aluno_nome: alunoNome || null,
    titulo,
    mensagem: mensagem || null,
  });
  console.log(`[SAAE][notificação] ${titulo}`);

  dispararEmails({ titulo, mensagem, escolaId, turma });
}

// Envia a notificação por e-mail à gestão, se o SMTP estiver configurado.
// É "fire-and-forget": uma falha no envio nunca deve quebrar a requisição nem
// impedir o registro da notificação no feed interno.
function dispararEmails({ titulo, mensagem, escolaId, turma }) {
  if (!emailConfigurado()) return; // sem SMTP → apenas feed interno

  const lista = destinatarios(escolaId, turma);
  if (!lista.length) return;

  const para = lista.map((u) => u.email);
  const texto =
    `${mensagem || titulo}\n\n` +
    '— Itaitinga Conectada · aviso automático. Não responda a este e-mail; ' +
    'acesse o sistema para acompanhar o alerta.';

  enviarEmail({ para, assunto: `[Itaitinga Conectada] ${titulo}`, texto }).catch((e) =>
    console.error(`[SAAE][email] Falha ao enviar notificação: ${e.message}`)
  );
}
