// Testes de integração dos recursos da expansão "Itaitinga Conectada":
// eixos do aluno (Saúde/Assistência/Vida Escolar), infraestrutura/cidadania,
// autocadastro/aprovação e RBAC do cidadão.
// Banco em memória, sem dependências externas.  Execute com:  npm test

process.env.SAAE_DB = ':memory:';
process.env.SAAE_SEGREDO = 'segredo-de-teste';
process.env.SAAE_UPLOADS = process.env.TEMP
  ? `${process.env.TEMP}/saae_uploads_test`
  : '/tmp/saae_uploads_test';

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

const { default: app } = await import('../src/server.js');
const { default: db } = await import('../src/db.js');

let server;
let base;
const estado = {};

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://localhost:${server.address().port}`;
});

after(() => server?.close());

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

test('setup: login admin, escola e 3 alunos na mesma turma', async () => {
  const login = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@saae.local', senha: 'admin123' },
  });
  assert.equal(login.status, 200);
  estado.adminToken = login.dados.token;

  const escola = await api('/api/escolas', {
    token: estado.adminToken,
    method: 'POST',
    body: { nome: 'Escola A', latitude: -3.97, longitude: -38.52 },
  });
  assert.equal(escola.status, 201);
  estado.escolaId = escola.dados.id;

  estado.alunos = [];
  for (const nome of ['Ana', 'Bruno', 'Carla']) {
    const a = await api('/api/alunos', {
      token: estado.adminToken,
      method: 'POST',
      body: { nome, matricula: 'M' + nome, turma: '9A', escola_id: estado.escolaId },
    });
    assert.equal(a.status, 201);
    estado.alunos.push(a.dados.id);
  }
});

test('Eixo A: salva saúde e lê de volta', async () => {
  const put = await api(`/api/saude/${estado.alunos[0]}`, {
    token: estado.adminToken,
    method: 'PUT',
    body: { vacinacao_status: 'em_dia', alergias: 'Amendoim' },
  });
  assert.equal(put.status, 200);
  assert.equal(put.dados.vacinacao_status, 'em_dia');

  const get = await api(`/api/saude/${estado.alunos[0]}`, { token: estado.adminToken });
  assert.equal(get.dados.alergias, 'Amendoim');
  assert.ok(Array.isArray(get.dados.sintomas));
});

test('Eixo A: sintomas na turma disparam alerta automático de surto', async () => {
  let ultimo;
  for (const id of estado.alunos) {
    const r = await api(`/api/saude/${id}/sintomas`, {
      token: estado.adminToken,
      method: 'POST',
      body: { sintomas: 'febre, tosse' },
    });
    assert.equal(r.status, 201);
    ultimo = r.dados;
  }
  assert.ok(ultimo.surto, 'o 3º registro deve indicar surto');
  assert.equal(ultimo.surto.alunos_afetados, 3);

  const notifs = await api('/api/notificacoes', { token: estado.adminToken });
  assert.ok(notifs.dados.notificacoes.some((n) => /surto/i.test(n.titulo)));
});

test('Eixo B: geolocalização em área de risco é sinalizada e notificada', async () => {
  db.prepare("INSERT INTO areas_risco (nome, latitude, longitude, raio_km) VALUES ('Centro', -3.97, -38.52, 2)").run();
  const r = await api(`/api/assistencia/${estado.alunos[0]}`, {
    token: estado.adminToken,
    method: 'PUT',
    body: { bolsa_familia: 1, latitude: -3.971, longitude: -38.521 },
  });
  assert.equal(r.status, 200);
  assert.equal(r.dados.em_area_risco, 1);
  assert.equal(r.dados.area_risco_nome, 'Centro');
});

test('Eixo B: endereço da residência é salvo e devolvido', async () => {
  const put = await api(`/api/assistencia/${estado.alunos[1]}`, {
    token: estado.adminToken,
    method: 'PUT',
    body: { endereco: 'Rua Teste, 123 - Centro', latitude: -3.968, longitude: -38.53 },
  });
  assert.equal(put.status, 200);
  assert.equal(put.dados.endereco, 'Rua Teste, 123 - Centro');

  const get = await api(`/api/assistencia/${estado.alunos[1]}`, { token: estado.adminToken });
  assert.equal(get.dados.endereco, 'Rua Teste, 123 - Centro');
});

test('Geo: geocodificar sem endereço responde 400 (sem chamar a rede)', async () => {
  const semEndereco = await api('/api/geo/geocodificar', { token: estado.adminToken });
  assert.equal(semEndereco.status, 400);
});

test('Eixo C: vida escolar + upload de foto no diário de bordo', async () => {
  const put = await api(`/api/vida-escolar/${estado.alunos[0]}`, {
    token: estado.adminToken,
    method: 'PUT',
    body: { frequencia_percentual: 92.5, projetos: 'Guardiões dos Biomas' },
  });
  assert.equal(put.status, 200);
  assert.equal(put.dados.frequencia_percentual, 92.5);

  // Upload multipart (PNG 1x1 fake).
  const fd = new FormData();
  const blob = new Blob([Buffer.from('89504E470D0A1A0A', 'hex')], { type: 'image/png' });
  fd.append('foto', blob, 'foto.png');
  fd.append('legenda', 'Horta da escola');
  const up = await fetch(`${base}/api/vida-escolar/${estado.alunos[0]}/fotos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${estado.adminToken}` },
    body: fd,
  });
  assert.equal(up.status, 201);
  const foto = await up.json();
  assert.match(foto.arquivo, /^\/uploads\//);

  const get = await api(`/api/vida-escolar/${estado.alunos[0]}`, { token: estado.adminToken });
  assert.equal(get.dados.fotos.length, 1);
  estado.fotoId = foto.id;
});

test('Eixo C: remoção de foto do diário', async () => {
  const del = await api(`/api/vida-escolar/fotos/${estado.fotoId}`, {
    token: estado.adminToken,
    method: 'DELETE',
  });
  assert.equal(del.status, 204);
});

test('Autocadastro: cidadão nasce ativo e consegue entrar', async () => {
  const reg = await api('/api/auth/registro', {
    method: 'POST',
    body: { nome: 'Zé', email: 'ze@itaitinga.gov', senha: 'senha123', perfil: 'cidadao' },
  });
  assert.equal(reg.status, 201);
  assert.equal(reg.dados.pendente, false);

  const login = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'ze@itaitinga.gov', senha: 'senha123' },
  });
  assert.equal(login.status, 200);
  estado.cidadaoToken = login.dados.token;
});

test('Infra: cidadão registra alerta; anônimo não vaza identidade', async () => {
  const nomeado = await api('/api/infra/alertas', {
    token: estado.cidadaoToken,
    method: 'POST',
    body: { categoria: 'buraco', descricao: 'Buraco grande', latitude: -3.97, longitude: -38.52 },
  });
  assert.equal(nomeado.status, 201);
  assert.equal(nomeado.dados.autor_nome, 'Zé');
  assert.equal(nomeado.dados.cidadao_id, undefined);

  const anon = await api('/api/infra/alertas', {
    token: estado.cidadaoToken,
    method: 'POST',
    body: { categoria: 'lixo', descricao: 'Lixo acumulado', anonimo: true },
  });
  assert.equal(anon.status, 201);
  assert.equal(anon.dados.anonimo, 1);
  assert.equal(anon.dados.autor_nome, null);
  estado.alertaInfraId = nomeado.dados.id;
});

test('Infra: GET é público e não expõe cidadao_id', async () => {
  const resp = await fetch(`${base}/api/infra/alertas`);
  assert.equal(resp.status, 200);
  const lista = await resp.json();
  assert.equal(lista.length, 2);
  assert.ok(lista.every((a) => a.cidadao_id === undefined));
});

test('Infra: só a Secretaria altera o status', async () => {
  const negado = await api(`/api/infra/alertas/${estado.alertaInfraId}`, {
    token: estado.cidadaoToken,
    method: 'PATCH',
    body: { status: 'resolvido' },
  });
  assert.equal(negado.status, 403);

  const ok = await api(`/api/infra/alertas/${estado.alertaInfraId}`, {
    token: estado.adminToken,
    method: 'PATCH',
    body: { status: 'resolvido' },
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.dados.status, 'resolvido');
});

test('RBAC: cidadão é bloqueado nas áreas de dados de aluno', async () => {
  const alunos = await api('/api/alunos', { token: estado.cidadaoToken });
  assert.equal(alunos.status, 403);
  const saude = await api(`/api/saude/${estado.alunos[0]}`, { token: estado.cidadaoToken });
  assert.equal(saude.status, 403);
});

test('Autocadastro de equipe nasce ativo e entra imediatamente', async () => {
  const reg = await api('/api/auth/registro', {
    method: 'POST',
    body: { nome: 'Prof Novo', email: 'prof@e.com', senha: 'senha123', perfil: 'professor', escola_id: estado.escolaId },
  });
  assert.equal(reg.status, 201);
  assert.equal(reg.dados.pendente, false);
  assert.equal(reg.dados.usuario.status, 'ativo');

  const login = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'prof@e.com', senha: 'senha123' },
  });
  assert.equal(login.status, 200);
  assert.ok(login.dados.token);
});

test('Autocadastro de equipe exige escola válida', async () => {
  const semEscola = await api('/api/auth/registro', {
    method: 'POST',
    body: { nome: 'Prof Sem Escola', email: 'prof2@e.com', senha: 'senha123', perfil: 'professor' },
  });
  assert.equal(semEscola.status, 400);
});

test('Autocadastro de secretaria é negado', async () => {
  const reg = await api('/api/auth/registro', {
    method: 'POST',
    body: { nome: 'X', email: 'x@e.com', senha: 'senha123', perfil: 'secretaria' },
  });
  assert.equal(reg.status, 400);
});

test('Documentos: upload (gestão), listagem e remoção', async () => {
  const fd = new FormData();
  fd.append('arquivo', new Blob([Buffer.from('%PDF-1.4 teste')], { type: 'application/pdf' }), 'laudo.pdf');
  fd.append('categoria', 'saude');
  fd.append('descricao', 'Laudo médico');
  const up = await fetch(`${base}/api/documentos/${estado.alunos[0]}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${estado.adminToken}` },
    body: fd,
  });
  assert.equal(up.status, 201);
  const doc = await up.json();
  assert.equal(doc.categoria, 'saude');
  assert.match(doc.arquivo, /^\/uploads\//);

  const lista = await api(`/api/documentos/${estado.alunos[0]}`, { token: estado.adminToken });
  assert.equal(lista.status, 200);
  assert.ok(lista.dados.some((d) => d.id === doc.id));

  const del = await api(`/api/documentos/${doc.id}`, { token: estado.adminToken, method: 'DELETE' });
  assert.equal(del.status, 204);
});

test('Documentos: cidadão é bloqueado', async () => {
  const r = await api(`/api/documentos/${estado.alunos[0]}`, { token: estado.cidadaoToken });
  assert.equal(r.status, 403);
});

test('Infra: descrição é opcional (usa o rótulo da categoria)', async () => {
  const r = await api('/api/infra/alertas', {
    token: estado.cidadaoToken,
    method: 'POST',
    body: { categoria: 'saneamento', latitude: -3.97, longitude: -38.52 },
  });
  assert.equal(r.status, 201);
  assert.equal(r.dados.descricao, 'Saneamento');
});
