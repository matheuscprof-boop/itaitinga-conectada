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

test('Eixo A: checklist de vacinas/doenças e medicamento controlado', async () => {
  const put = await api(`/api/saude/${estado.alunos[0]}`, {
    token: estado.adminToken,
    method: 'PUT',
    body: {
      vacinacao_status: 'em_dia',
      vacinas_tomadas: ['hpv', 'covid19', 'INVALIDA'],
      doencas: ['asma', 'tea'],
      doencas_outros: 'Escoliose',
      usa_medicamento_controlado: 1,
      medicamentos: 'Metilfenidato',
    },
  });
  assert.equal(put.status, 200);
  // Valores fora da lista permitida são descartados.
  assert.equal(put.dados.vacinas_tomadas, 'hpv,covid19');
  assert.equal(put.dados.doencas, 'asma,tea');
  assert.equal(put.dados.doencas_outros, 'Escoliose');
  assert.equal(put.dados.usa_medicamento_controlado, 1);
  assert.equal(put.dados.medicamentos, 'Metilfenidato');
});

test('Eixo A: desmarcar medicamento controlado limpa os medicamentos', async () => {
  const put = await api(`/api/saude/${estado.alunos[0]}`, {
    token: estado.adminToken,
    method: 'PUT',
    body: { vacinacao_status: 'em_dia', usa_medicamento_controlado: 0, medicamentos: 'ignorar' },
  });
  assert.equal(put.dados.usa_medicamento_controlado, 0);
  assert.equal(put.dados.medicamentos, null);
});

test('Eixo A: anexa/remove carteira de vacina sem apagar os demais campos', async () => {
  const fd = new FormData();
  fd.append('arquivo', new Blob([Buffer.from('%PDF-1.4 vacina')], { type: 'application/pdf' }), 'carteira.pdf');
  const up = await fetch(`${base}/api/saude/${estado.alunos[0]}/cartao-vacina`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${estado.adminToken}` },
    body: fd,
  });
  assert.equal(up.status, 201);
  const saude = await up.json();
  assert.match(saude.cartao_vacina, /^\/uploads\//);
  assert.ok(saude.vacinacao_atualizada_em, 'a data de atualização deve ser carimbada');
  // O upsert do anexo é separado: não zera o que foi salvo pelo PUT.
  assert.equal(saude.vacinacao_status, 'em_dia');

  const del = await api(`/api/saude/${estado.alunos[0]}/cartao-vacina`, {
    token: estado.adminToken, method: 'DELETE',
  });
  assert.equal(del.status, 200);
  assert.equal(del.dados.cartao_vacina, null);
});

test('Eixo A: anexa a receita médica', async () => {
  const fd = new FormData();
  fd.append('arquivo', new Blob([Buffer.from('89504E470D0A1A0A', 'hex')], { type: 'image/png' }), 'receita.png');
  const up = await fetch(`${base}/api/saude/${estado.alunos[0]}/receita`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${estado.adminToken}` },
    body: fd,
  });
  assert.equal(up.status, 201);
  const saude = await up.json();
  assert.match(saude.receita, /^\/uploads\//);
});

test('Eixo A: peso/altura salvam; gestação só vale para alunas', async () => {
  // Cria uma aluna (sexo feminino).
  const aluna = await api('/api/alunos', {
    token: estado.adminToken,
    method: 'POST',
    body: { nome: 'Duda', matricula: 'MDuda', turma: '9A', sexo: 'feminino', escola_id: estado.escolaId },
  });
  assert.equal(aluna.status, 201);
  assert.equal(aluna.dados.sexo, 'feminino');

  // Aluna: peso (aceita vírgula decimal), altura e gestação persistem.
  const put = await api(`/api/saude/${aluna.dados.id}`, {
    token: estado.adminToken,
    method: 'PUT',
    body: { vacinacao_status: 'pendente', peso: '54,5', altura: 1.6, gravidez: 1, gravidez_historico: 1, pre_natal: 1 },
  });
  assert.equal(put.status, 200);
  assert.equal(put.dados.peso, 54.5);
  assert.equal(put.dados.altura, 1.6);
  assert.equal(put.dados.gravidez, 1);
  assert.equal(put.dados.gravidez_historico, 1);
  assert.equal(put.dados.pre_natal, 1);

  // Pré-natal só vale se gestante: desmarcar gravidez zera o pré-natal.
  const put1b = await api(`/api/saude/${aluna.dados.id}`, {
    token: estado.adminToken,
    method: 'PUT',
    body: { vacinacao_status: 'pendente', gravidez: 0, pre_natal: 1 },
  });
  assert.equal(put1b.dados.gravidez, 0);
  assert.equal(put1b.dados.pre_natal, 0);

  // Aluno sem sexo feminino: peso/altura entram, mas gestação é forçada a 0.
  const put2 = await api(`/api/saude/${estado.alunos[1]}`, {
    token: estado.adminToken,
    method: 'PUT',
    body: { vacinacao_status: 'pendente', peso: 70, altura: 1.75, gravidez: 1, gravidez_historico: 1, pre_natal: 1 },
  });
  assert.equal(put2.dados.peso, 70);
  assert.equal(put2.dados.gravidez, 0);
  assert.equal(put2.dados.gravidez_historico, 0);
  assert.equal(put2.dados.pre_natal, 0);
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

test('Eixo C: PcD, condição e upload/remoção do PEI', async () => {
  const put = await api(`/api/vida-escolar/${estado.alunos[1]}`, {
    token: estado.adminToken,
    method: 'PUT',
    body: { pcd: 1, pcd_condicao: 'Deficiência auditiva' },
  });
  assert.equal(put.status, 200);
  assert.equal(put.dados.pcd, 1);
  assert.equal(put.dados.pcd_condicao, 'Deficiência auditiva');

  // Anexa o PEI (PDF) — upsert separado não apaga o pcd_condicao.
  const fd = new FormData();
  fd.append('arquivo', new Blob([Buffer.from('%PDF-1.4 PEI')], { type: 'application/pdf' }), 'pei.pdf');
  const up = await fetch(`${base}/api/vida-escolar/${estado.alunos[1]}/pei`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${estado.adminToken}` },
    body: fd,
  });
  assert.equal(up.status, 201);
  const vida = await up.json();
  assert.match(vida.pei, /^\/uploads\//);
  assert.equal(vida.pcd_condicao, 'Deficiência auditiva');

  const del = await api(`/api/vida-escolar/${estado.alunos[1]}/pei`, {
    token: estado.adminToken, method: 'DELETE',
  });
  assert.equal(del.status, 200);
  assert.equal(del.dados.pei, null);
});

test('Eixo C: desmarcar PcD limpa a condição', async () => {
  const put = await api(`/api/vida-escolar/${estado.alunos[1]}`, {
    token: estado.adminToken,
    method: 'PUT',
    body: { pcd: 0, pcd_condicao: 'ignorar' },
  });
  assert.equal(put.dados.pcd, 0);
  assert.equal(put.dados.pcd_condicao, null);
});

// Lê o código de verificação diretamente do banco (compartilhado com o server).
function codigoDe(email) {
  return db.prepare('SELECT codigo_verificacao FROM usuarios WHERE email = ?').get(email)?.codigo_verificacao;
}

test('Autocadastro: cidadão verifica o e-mail e então consegue entrar', async () => {
  const reg = await api('/api/auth/registro', {
    method: 'POST',
    body: { nome: 'Zé', email: 'ze@itaitinga.gov', senha: 'senha123', perfil: 'cidadao' },
  });
  assert.equal(reg.status, 201);
  assert.equal(reg.dados.precisa_verificar, true);
  assert.equal(reg.dados.pendente_aprovacao, false);

  // Antes de verificar o e-mail, o login é bloqueado.
  const bloq = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'ze@itaitinga.gov', senha: 'senha123' },
  });
  assert.equal(bloq.status, 403);
  assert.equal(bloq.dados.motivo, 'email_nao_verificado');

  // Confirma o e-mail com o código.
  const ver = await api('/api/auth/verificar-email', {
    method: 'POST',
    body: { email: 'ze@itaitinga.gov', codigo: codigoDe('ze@itaitinga.gov') },
  });
  assert.equal(ver.status, 200);
  assert.equal(ver.dados.pendente_aprovacao, false);

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

test('Infra: bairro é salvo, listado e filtra os alertas', async () => {
  const criado = await api('/api/infra/alertas', {
    token: estado.cidadaoToken,
    method: 'POST',
    body: { categoria: 'buraco', descricao: 'Buraco no Centro', bairro: 'Centro' },
  });
  assert.equal(criado.status, 201);
  assert.equal(criado.dados.bairro, 'Centro');

  // O bairro aparece na lista de bairros distintos (para o filtro).
  const bairros = await (await fetch(`${base}/api/infra/bairros`)).json();
  assert.ok(bairros.includes('Centro'));

  // Filtro por bairro (case-insensitive) só retorna alertas do bairro.
  const filtrado = await (await fetch(`${base}/api/infra/alertas?bairro=centro`)).json();
  assert.ok(filtrado.length >= 1);
  assert.ok(filtrado.every((a) => a.bairro === 'Centro'));
});

test('RBAC: cidadão é bloqueado nas áreas de dados de aluno', async () => {
  const alunos = await api('/api/alunos', { token: estado.cidadaoToken });
  assert.equal(alunos.status, 403);
  const saude = await api(`/api/saude/${estado.alunos[0]}`, { token: estado.cidadaoToken });
  assert.equal(saude.status, 403);
});

test('Autocadastro de equipe: verifica e-mail, fica pendente e entra após aprovação', async () => {
  const reg = await api('/api/auth/registro', {
    method: 'POST',
    body: { nome: 'Prof Novo', email: 'prof@e.com', senha: 'senha123', perfil: 'professor', escola_id: estado.escolaId },
  });
  assert.equal(reg.status, 201);
  assert.equal(reg.dados.pendente_aprovacao, true);

  // Verifica o e-mail — mas ainda fica pendente de aprovação.
  const ver = await api('/api/auth/verificar-email', {
    method: 'POST',
    body: { email: 'prof@e.com', codigo: codigoDe('prof@e.com') },
  });
  assert.equal(ver.status, 200);
  assert.equal(ver.dados.pendente_aprovacao, true);

  const bloq = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'prof@e.com', senha: 'senha123' },
  });
  assert.equal(bloq.status, 403);
  assert.equal(bloq.dados.motivo, 'pendente');

  // A secretaria (admin) vê o pendente e aprova.
  const pend = await api('/api/auth/usuarios/pendentes', { token: estado.adminToken });
  assert.equal(pend.status, 200);
  const alvo = pend.dados.find((u) => u.email === 'prof@e.com');
  assert.ok(alvo, 'a conta pendente deve aparecer na lista');
  const apr = await api(`/api/auth/usuarios/${alvo.id}/aprovar`, { token: estado.adminToken, method: 'PATCH' });
  assert.equal(apr.status, 200);

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

test('Autocadastro de secretaria escolar exige escola e nasce pendente', async () => {
  const semEscola = await api('/api/auth/registro', {
    method: 'POST',
    body: { nome: 'Sec Esc', email: 'secesc@e.com', senha: 'senha123', perfil: 'secretaria_escolar' },
  });
  assert.equal(semEscola.status, 400);

  const reg = await api('/api/auth/registro', {
    method: 'POST',
    body: { nome: 'Sec Esc', email: 'secesc@e.com', senha: 'senha123', perfil: 'secretaria_escolar', escola_id: estado.escolaId, cargo: 'Secretária', matricula_funcional: '12345' },
  });
  assert.equal(reg.status, 201);
  assert.equal(reg.dados.pendente_aprovacao, true);
});

test('Autocadastro de secretaria municipal é permitido e nasce pendente', async () => {
  const reg = await api('/api/auth/registro', {
    method: 'POST',
    body: { nome: 'Sec Nova', email: 'secnova@e.com', senha: 'senha123', perfil: 'secretaria' },
  });
  assert.equal(reg.status, 201);
  assert.equal(reg.dados.pendente_aprovacao, true);
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
