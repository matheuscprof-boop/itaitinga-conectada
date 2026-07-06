// Testes de integração das rotas da API, usando o runner nativo do Node
// (node:test) e um banco em memória — sem dependências externas.
// Execute com:  npm test   (dentro da pasta backend)

// Configura o ambiente ANTES de importar o app (o db lê estas variáveis).
process.env.SAAE_DB = ':memory:';
process.env.SAAE_SEGREDO = 'segredo-de-teste';

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

// Importação dinâmica para garantir que as variáveis acima já estejam setadas.
const { default: app } = await import('../src/server.js');

let server;
let base;

before(async () => {
  server = app.listen(0); // porta efêmera
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

// Estado compartilhado entre os testes (executados em ordem).
const estado = {};

test('GET /api/health é público e responde ok', async () => {
  const { status, dados } = await api('/api/health');
  assert.equal(status, 200);
  assert.equal(dados.ok, true);
});

test('rota protegida sem token retorna 401', async () => {
  const { status } = await api('/api/alunos');
  assert.equal(status, 401);
});

test('login do admin padrão (secretaria) retorna token', async () => {
  const { status, dados } = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@saae.local', senha: 'admin123' },
  });
  assert.equal(status, 200);
  assert.ok(dados.token, 'deve retornar um token');
  assert.equal(dados.usuario.perfil, 'secretaria');
  estado.adminToken = dados.token;
});

test('secretaria cria escolas', async () => {
  const a = await api('/api/escolas', {
    token: estado.adminToken,
    method: 'POST',
    body: { nome: 'Escola A', municipio: 'Cidade', latitude: -23.5, longitude: -46.6 },
  });
  assert.equal(a.status, 201);
  estado.escolaA = a.dados.id;

  const b = await api('/api/escolas', {
    token: estado.adminToken,
    method: 'POST',
    body: { nome: 'Escola B', municipio: 'Cidade', latitude: -23.6, longitude: -46.7 },
  });
  assert.equal(b.status, 201);
  estado.escolaB = b.dados.id;
});

test('secretaria cria um professor vinculado à Escola A', async () => {
  const criar = await api('/api/auth/usuarios', {
    token: estado.adminToken,
    method: 'POST',
    body: { nome: 'Prof. Teste', email: 'prof@teste.local', senha: 'senha123', perfil: 'professor', escola_id: estado.escolaA },
  });
  assert.equal(criar.status, 201);
  assert.equal(criar.dados.escola_id, estado.escolaA);

  const login = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'prof@teste.local', senha: 'senha123' },
  });
  assert.equal(login.status, 200);
  estado.profToken = login.dados.token;
});

test('professor NÃO pode cadastrar aluno (403)', async () => {
  const { status } = await api('/api/alunos', {
    token: estado.profToken,
    method: 'POST',
    body: { nome: 'Fulano', matricula: '9001', turma: '6º A' },
  });
  assert.equal(status, 403);
});

test('secretaria cadastra alunos nas duas escolas', async () => {
  const a = await api('/api/alunos', {
    token: estado.adminToken,
    method: 'POST',
    body: { nome: 'Maria Aluna', matricula: '9002', turma: '6º A', escola_id: estado.escolaA },
  });
  assert.equal(a.status, 201);
  estado.alunoA = a.dados.id;

  const b = await api('/api/alunos', {
    token: estado.adminToken,
    method: 'POST',
    body: { nome: 'João Outro', matricula: '9003', turma: '7º B', escola_id: estado.escolaB },
  });
  assert.equal(b.status, 201);
  estado.alunoB = b.dados.id;
});

test('secretaria sem escola_id ao criar aluno retorna 400', async () => {
  const { status } = await api('/api/alunos', {
    token: estado.adminToken,
    method: 'POST',
    body: { nome: 'Sem Escola', matricula: '9099', turma: '9º Z' },
  });
  assert.equal(status, 400);
});

test('matrícula duplicada retorna 409', async () => {
  const { status } = await api('/api/alunos', {
    token: estado.adminToken,
    method: 'POST',
    body: { nome: 'Outro', matricula: '9002', turma: '6º B', escola_id: estado.escolaA },
  });
  assert.equal(status, 409);
});

test('escopo: professor da Escola A não vê aluno da Escola B (404)', async () => {
  const get = await api(`/api/alunos/${estado.alunoB}`, { token: estado.profToken });
  assert.equal(get.status, 404);

  const lista = await api('/api/alunos', { token: estado.profToken });
  const ids = lista.dados.map((a) => a.id);
  assert.ok(ids.includes(estado.alunoA));
  assert.ok(!ids.includes(estado.alunoB));
});

test('professor registra um alerta e a linha do tempo é iniciada', async () => {
  const criar = await api('/api/alertas', {
    token: estado.profToken,
    method: 'POST',
    body: { aluno_id: estado.alunoA, eixo: 'frequencia', nivel: 'alto', titulo: 'Muitas faltas' },
  });
  assert.equal(criar.status, 201);
  estado.alertaId = criar.dados.id;

  const hist = await api(`/api/alertas/${estado.alertaId}/historico`, { token: estado.profToken });
  assert.equal(hist.status, 200);
  assert.equal(hist.dados.length, 1);
  assert.equal(hist.dados[0].status_novo, 'aberto');
});

test('professor NÃO registra alerta para aluno de outra escola (403)', async () => {
  const { status } = await api('/api/alertas', {
    token: estado.profToken,
    method: 'POST',
    body: { aluno_id: estado.alunoB, eixo: 'frequencia', nivel: 'medio', titulo: 'x' },
  });
  assert.equal(status, 403);
});

test('mudança de status adiciona entrada no histórico', async () => {
  const patch = await api(`/api/alertas/${estado.alertaId}`, {
    token: estado.profToken,
    method: 'PATCH',
    body: { status: 'em_andamento' },
  });
  assert.equal(patch.status, 200);
  const hist = await api(`/api/alertas/${estado.alertaId}/historico`, { token: estado.profToken });
  assert.equal(hist.dados.length, 2);
  assert.equal(hist.dados[1].status_novo, 'em_andamento');
});

test('comentário é adicionado à linha do tempo', async () => {
  const com = await api(`/api/alertas/${estado.alertaId}/historico`, {
    token: estado.profToken,
    method: 'POST',
    body: { texto: 'Conversei com o responsável.' },
  });
  assert.equal(com.status, 201);
  const hist = await api(`/api/alertas/${estado.alertaId}/historico`, { token: estado.profToken });
  assert.equal(hist.dados.length, 3);
});

test('professor NÃO pode remover alerta (403)', async () => {
  const { status } = await api(`/api/alertas/${estado.alertaId}`, {
    token: estado.profToken,
    method: 'DELETE',
  });
  assert.equal(status, 403);
});

test('relatório resumo e série contam o alerta', async () => {
  const resumo = await api('/api/relatorios/resumo', { token: estado.adminToken });
  assert.equal(resumo.status, 200);
  assert.ok(resumo.dados.total >= 1);

  const serie = await api('/api/relatorios/serie?dimensao=eixo', { token: estado.adminToken });
  const freq = serie.dados.serie.find((s) => s.chave === 'frequencia');
  assert.ok(freq && freq.total >= 1);
});

test('matriz (mapeamento) eixo × escola retorna células', async () => {
  const r = await api('/api/relatorios/matriz?linha=eixo&coluna=escola', { token: estado.adminToken });
  assert.equal(r.status, 200);
  assert.ok(r.dados.colunas.length >= 1);
});

test('mapa retorna as escolas com contagens', async () => {
  const r = await api('/api/relatorios/mapa', { token: estado.adminToken });
  assert.equal(r.status, 200);
  assert.ok(r.dados.length >= 2, 'as duas escolas devem aparecer');
  const escolaA = r.dados.find((e) => e.escola_id === estado.escolaA);
  assert.ok(escolaA.abertos >= 1);
});

test('alerta de nível alto gerou notificação para a gestão', async () => {
  const lista = await api('/api/notificacoes', { token: estado.adminToken });
  assert.equal(lista.status, 200);
  assert.ok(lista.dados.notificacoes.length >= 1);
  assert.ok(lista.dados.nao_lidas >= 1);
});

test('professor NÃO acessa notificações (403)', async () => {
  const { status } = await api('/api/notificacoes', { token: estado.profToken });
  assert.equal(status, 403);
});

test('usuário troca a própria senha e reautentica', async () => {
  const troca = await api('/api/auth/senha', {
    token: estado.profToken,
    method: 'PATCH',
    body: { senha_atual: 'senha123', nova_senha: 'novaSenha456' },
  });
  assert.equal(troca.status, 200);

  const antiga = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'prof@teste.local', senha: 'senha123' },
  });
  assert.equal(antiga.status, 401);

  const nova = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'prof@teste.local', senha: 'novaSenha456' },
  });
  assert.equal(nova.status, 200);
});
