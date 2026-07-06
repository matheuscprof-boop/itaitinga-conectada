// Testes do envio de notificações por e-mail (SMTP).
// Injeta um transporte falso (registra as mensagens em vez de enviar) para
// validar QUANDO se envia e PARA QUEM, sem depender de servidor SMTP real.
// Banco em memória. Execute com:  npm test

process.env.SAAE_DB = ':memory:';
process.env.SAAE_SEGREDO = 'segredo-de-teste';

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

const { default: app } = await import('../src/server.js');
const email = await import('../src/email.js');

let server;
let base;
const enviados = [];
const estado = {};

before(async () => {
  // Transporte falso: apenas guarda as mensagens que seriam enviadas.
  email.configurarTransporteParaTeste({
    sendMail: async (msg) => {
      enviados.push(msg);
      return { messageId: 'teste' };
    },
  });
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://localhost:${server.address().port}`;
});

after(() => {
  email.resetTransporteParaTeste();
  server?.close();
});

async function api(caminho, { token, method = 'GET', body } = {}) {
  const resp = await fetch(base + caminho, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const texto = await resp.text();
  return { status: resp.status, dados: texto ? JSON.parse(texto) : null };
}

async function criarUsuario(perfil, nome, emailAddr, escolaId) {
  const resp = await api('/api/auth/usuarios', {
    token: estado.adminToken,
    method: 'POST',
    body: { nome, email: emailAddr, senha: 'senha123', perfil, escola_id: escolaId },
  });
  assert.equal(resp.status, 201, `criar ${perfil} deveria dar 201`);
  return resp.dados;
}

test('setup: transporte configurado, escolas e equipe de gestão', async () => {
  assert.equal(email.emailConfigurado(), true, 'transporte de teste habilita o e-mail');

  const login = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@saae.local', senha: 'admin123' },
  });
  assert.equal(login.status, 200);
  estado.adminToken = login.dados.token; // secretaria: admin@saae.local

  const escolaA = await api('/api/escolas', {
    token: estado.adminToken,
    method: 'POST',
    body: { nome: 'Escola A', latitude: -3.97, longitude: -38.52 },
  });
  const escolaB = await api('/api/escolas', {
    token: estado.adminToken,
    method: 'POST',
    body: { nome: 'Escola B', latitude: -3.98, longitude: -38.53 },
  });
  assert.equal(escolaA.status, 201);
  assert.equal(escolaB.status, 201);
  estado.escolaA = escolaA.dados.id;
  estado.escolaB = escolaB.dados.id;

  // Gestão da Escola A (deve receber), professor da A (NÃO recebe) e
  // coordenação da Escola B (NÃO recebe, escopo diferente).
  await criarUsuario('coordenacao', 'Coord A', 'coord-a@escola.local', estado.escolaA);
  await criarUsuario('direcao', 'Dir A', 'dir-a@escola.local', estado.escolaA);
  const profA = await criarUsuario('professor', 'Prof A', 'prof-a@escola.local', estado.escolaA);
  estado.profA = profA.id;
  await criarUsuario('coordenacao', 'Coord B', 'coord-b@escola.local', estado.escolaB);

  const aluno = await api('/api/alunos', {
    token: estado.adminToken,
    method: 'POST',
    body: { nome: 'Aluno A', matricula: 'M-A-1', turma: '9A', escola_id: estado.escolaA },
  });
  assert.equal(aluno.status, 201);
  estado.alunoA = aluno.dados.id;
});

test('alerta de nível ALTO envia e-mail à gestão do escopo (e só a ela)', async () => {
  enviados.length = 0;

  const alerta = await api('/api/alertas', {
    token: estado.adminToken,
    method: 'POST',
    body: {
      aluno_id: estado.alunoA,
      eixo: 'frequencia',
      nivel: 'alto',
      titulo: 'Muitas faltas seguidas',
    },
  });
  assert.equal(alerta.status, 201);

  // O envio é "fire-and-forget"; dá um tick para o promise assentar.
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(enviados.length, 1, 'deveria ter enviado exatamente 1 e-mail');
  const msg = enviados[0];
  const destinatarios = msg.to.split(',').map((e) => e.trim());

  // Recebem: secretaria (municipal) + coordenação/direção da Escola A.
  assert.ok(destinatarios.includes('admin@saae.local'), 'secretaria recebe');
  assert.ok(destinatarios.includes('coord-a@escola.local'), 'coordenação da A recebe');
  assert.ok(destinatarios.includes('dir-a@escola.local'), 'direção da A recebe');

  // NÃO recebem: professor (sem acesso ao feed) e gestão de outra escola.
  assert.ok(!destinatarios.includes('prof-a@escola.local'), 'professor não recebe');
  assert.ok(!destinatarios.includes('coord-b@escola.local'), 'gestão de outra escola não recebe');

  assert.match(msg.subject, /Muitas faltas seguidas/);
  assert.match(msg.from, /Itaitinga Conectada/);
  assert.ok(msg.text && msg.text.length > 0, 'corpo do e-mail preenchido');
});

test('professor responsável pela turma recebe o e-mail (e só ele, no escopo)', async () => {
  // Professor da Escola B também "responsável" pela turma 9A não deve receber
  // (turma igual, mas escola diferente).
  const profB = await criarUsuario('professor', 'Prof B', 'prof-b@escola.local', estado.escolaB);

  // Atribui a turma 9A ao professor da Escola A e ao da Escola B.
  const put = await api(`/api/auth/usuarios/${estado.profA}/turmas`, {
    token: estado.adminToken,
    method: 'PUT',
    body: { turmas: ['9A', '9A', ' '] }, // duplicata e vazio são ignorados
  });
  assert.equal(put.status, 200);
  assert.deepEqual(put.dados.turmas, ['9A']);
  await api(`/api/auth/usuarios/${profB.id}/turmas`, {
    token: estado.adminToken,
    method: 'PUT',
    body: { turmas: ['9A'] },
  });

  enviados.length = 0;
  const alerta = await api('/api/alertas', {
    token: estado.adminToken,
    method: 'POST',
    body: { aluno_id: estado.alunoA, eixo: 'socioemocional', nivel: 'alto', titulo: 'Sinal de alerta' },
  });
  assert.equal(alerta.status, 201);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(enviados.length, 1);
  const destinatarios = enviados[0].to.split(',').map((e) => e.trim());
  assert.ok(destinatarios.includes('prof-a@escola.local'), 'professor da turma na escola A recebe');
  assert.ok(!destinatarios.includes('prof-b@escola.local'), 'professor de outra escola não recebe');
  // Gestão continua recebendo.
  assert.ok(destinatarios.includes('admin@saae.local'));
});

test('PUT /usuarios/:id/turmas rejeita quem não é professor', async () => {
  // coord-a é coordenação: não deve aceitar atribuição de turmas.
  const coord = (await api('/api/auth/usuarios', { token: estado.adminToken })).dados.find(
    (u) => u.email === 'coord-a@escola.local'
  );
  const resp = await api(`/api/auth/usuarios/${coord.id}/turmas`, {
    token: estado.adminToken,
    method: 'PUT',
    body: { turmas: ['9A'] },
  });
  assert.equal(resp.status, 400);
});

test('alerta de nível médio NÃO envia e-mail', async () => {
  enviados.length = 0;

  const alerta = await api('/api/alertas', {
    token: estado.adminToken,
    method: 'POST',
    body: {
      aluno_id: estado.alunoA,
      eixo: 'desempenho',
      nivel: 'medio',
      titulo: 'Queda leve nas notas',
    },
  });
  assert.equal(alerta.status, 201);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(enviados.length, 0, 'nível médio não gera e-mail');
});
