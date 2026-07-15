// Seed de DEMONSTRAÇÃO do eixo Saúde — sexo dos alunos + exemplos de gestação.
// Uso:  npm run seed:gestacao   (dentro da pasta backend)
//
// O que faz (idempotente, NÃO apaga alunos nem outras informações):
//   1) Infere o `sexo` de cada aluno a partir do primeiro nome — o pool de
//      nomes do seed de alunos (`seed-alunos-ficticios.js`) é fixo e conhecido.
//   2) Popula o Panorama de Saúde com um conjunto FIXO e determinístico:
//        - 2 gestantes atuais (1 COM acompanhamento pré-natal, 1 SEM), ambas
//          com localização residencial (para aparecerem no mapa);
//        - 1 estudante com histórico de gestação.
//      Para ser idempotente, as flags de gestação (gravidez/histórico/pré-natal)
//      de TODAS as alunas são zeradas antes de aplicar o exemplo — assim rodar
//      de novo converge para o mesmo estado. Só mexe nessas 3 colunas e na
//      localização das escolhidas; nenhum registro é removido.
//
// Requer alunos já cadastrados (rode antes: npm run seed:alunos).

import db from './db.js';

// Classificação de sexo pelos primeiros nomes usados no seed de alunos.
const FEMININOS = new Set([
  'Ana', 'Beatriz', 'Carla', 'Eduarda', 'Helena', 'Júlia', 'Larissa', 'Natália',
  'Paula', 'Sofia', 'Valentina', 'Yasmin', 'Lívia', 'Manuela', 'Isadora', 'Alice',
  'Cecília', 'Laura', 'Maria', 'Antônia',
]);
const MASCULINOS = new Set([
  'Bruno', 'Daniel', 'Felipe', 'Gabriel', 'Igor', 'Kauã', 'Miguel', 'Otávio',
  'Rafael', 'Thiago', 'Enzo', 'Davi', 'Lucas', 'Pedro', 'Arthur', 'Heitor',
  'Bernardo', 'Vinícius',
]);

// Localizações residenciais fictícias (bairros de Itaitinga) para o mapa.
const LOCAIS = {
  centro: { endereco: 'Centro, Itaitinga', latitude: -3.9685, longitude: -38.5262 },
  gereru: { endereco: 'Gereraú, Itaitinga', latitude: -3.9412, longitude: -38.5039 },
};

const updSexo = db.prepare('UPDATE alunos SET sexo = @sexo WHERE id = @id');
const zerarGestacao = db.prepare('UPDATE saude_aluno SET gravidez = 0, gravidez_historico = 0, pre_natal = 0');
const upSaude = db.prepare(`
  INSERT INTO saude_aluno (aluno_id, vacinacao_status, peso, altura, gravidez, gravidez_historico, pre_natal, atualizado_em)
  VALUES (@id, 'pendente', @peso, @altura, @grav, @hist, @pre, datetime('now'))
  ON CONFLICT(aluno_id) DO UPDATE SET
    peso = excluded.peso, altura = excluded.altura, gravidez = excluded.gravidez,
    gravidez_historico = excluded.gravidez_historico, pre_natal = excluded.pre_natal,
    atualizado_em = datetime('now')
`);
const upAssist = db.prepare(`
  INSERT INTO assistencia_aluno (aluno_id, endereco, latitude, longitude, atualizado_em)
  VALUES (@id, @endereco, @latitude, @longitude, datetime('now'))
  ON CONFLICT(aluno_id) DO UPDATE SET
    endereco = excluded.endereco, latitude = excluded.latitude, longitude = excluded.longitude,
    atualizado_em = datetime('now')
`);

const aplicar = db.transaction(() => {
  // 1) Sexo por primeiro nome.
  let f = 0, m = 0;
  for (const a of db.prepare('SELECT id, nome FROM alunos').all()) {
    const primeiro = a.nome.split(' ')[0];
    const sexo = FEMININOS.has(primeiro) ? 'feminino' : MASCULINOS.has(primeiro) ? 'masculino' : null;
    if (!sexo) continue;
    updSexo.run({ id: a.id, sexo });
    if (sexo === 'feminino') f += 1; else m += 1;
  }

  // 2) Zera as flags de gestação (idempotência) e escolhe 3 alunas do 9º ano
  //    (as mais velhas), determinístico por id. As duas gestantes ficam em
  //    ESCOLAS DIFERENTES para o mapa não parecer "duas no mesmo lugar".
  zerarGestacao.run();
  let alunas = db
    .prepare("SELECT id, nome, turma, escola_id FROM alunos WHERE sexo = 'feminino' AND turma LIKE '9%' ORDER BY id")
    .all();
  if (alunas.length < 3) {
    alunas = db.prepare("SELECT id, nome, turma, escola_id FROM alunos WHERE sexo = 'feminino' ORDER BY id").all();
  }

  const g1 = alunas[0];
  // 2ª gestante: a primeira de uma ESCOLA diferente da 1ª (senão, a próxima).
  const g2 = alunas.find((a) => g1 && a.escola_id !== g1.escola_id) || alunas[1];
  // Histórico: a primeira que não seja g1 nem g2.
  const hist = alunas.find((a) => a.id !== g1?.id && a.id !== g2?.id) || alunas[2];

  const marcadas = [];
  if (g1) {
    upSaude.run({ id: g1.id, peso: 56, altura: 1.60, grav: 1, hist: 0, pre: 1 });
    upAssist.run({ id: g1.id, ...LOCAIS.centro });
    marcadas.push(`gestante c/ pré-natal: ${g1.nome} (${g1.turma})`);
  }
  if (g2) {
    upSaude.run({ id: g2.id, peso: 60, altura: 1.63, grav: 1, hist: 0, pre: 0 });
    upAssist.run({ id: g2.id, ...LOCAIS.gereru });
    marcadas.push(`gestante s/ pré-natal: ${g2.nome} (${g2.turma})`);
  }
  if (hist) {
    upSaude.run({ id: hist.id, peso: 58.5, altura: 1.62, grav: 0, hist: 1, pre: 0 });
    marcadas.push(`histórico de gestação: ${hist.nome} (${hist.turma})`);
  }
  return { f, m, marcadas };
});

const r = aplicar();
console.log(`Sexo definido → feminino: ${r.f}, masculino: ${r.m}.`);
r.marcadas.forEach((linha) => console.log(`  ${linha}`));
if (r.marcadas.length === 0) {
  console.log('Nenhuma aluna encontrada. Rode antes: npm run seed:alunos');
}
