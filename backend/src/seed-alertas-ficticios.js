// Gera ALERTAS FICTÍCIOS para os alunos, preenchendo mapa, dashboard e painel
// analítico. Uso:  npm run seed:alertas   (dentro da pasta backend)
//
// IDEMPOTENTE (pula alunos que já têm algum alerta) e NÃO destrutivo. Distribui
// os 3 eixos, os níveis (baixo/médio/alto) e os status (aberto/andamento/
// resolvido) de forma variada, deixando ~20% dos alunos sem alerta (para o mapa
// ter escolas "sem alerta" 🏫 também). Alertas de nível ALTO em aberto geram
// notificação no feed da gestão (como na aplicação real).

import db from './db.js';
import { dataFicticia } from './datas-ficticias.js';

const alunos = db.prepare('SELECT id, nome, turma, escola_id FROM alunos ORDER BY id').all();
if (alunos.length === 0) {
  console.error('Nenhum aluno encontrado. Rode antes: npm run seed:alunos');
  process.exit(1);
}

const EIXOS = ['frequencia', 'desempenho', 'socioemocional'];
const STATUS = ['aberto', 'em_andamento', 'resolvido'];
const TITULOS = {
  frequencia: ['Faltas recorrentes às segundas', 'Ausência prolongada', 'Atrasos frequentes', 'Queda na frequência'],
  desempenho: ['Queda nas notas de Matemática', 'Dificuldade em leitura', 'Baixo desempenho em Ciências', 'Notas abaixo da média'],
  socioemocional: ['Isolamento em atividades de grupo', 'Conflitos com colegas', 'Sinais de ansiedade', 'Desmotivação relatada'],
};

const temAlerta = db.prepare('SELECT 1 FROM alertas WHERE aluno_id = ? LIMIT 1');
const inserirAlerta = db.prepare(`
  INSERT INTO alertas (aluno_id, eixo, nivel, titulo, descricao, status, criado_em, atualizado_em)
  VALUES (@aluno_id, @eixo, @nivel, @titulo, @descricao, @status, @criado_em, @criado_em)
`);
const inserirHist = db.prepare(`
  INSERT INTO alerta_historico (alerta_id, tipo, texto, status_novo, autor_nome, criado_em)
  VALUES (@alerta_id, 'mudanca_status', 'Alerta registrado (dados fictícios).', @status, 'Seed', @criado_em)
`);
const inserirNotif = db.prepare(`
  INSERT INTO notificacoes (alerta_id, escola_id, aluno_nome, titulo, mensagem)
  VALUES (@alerta_id, @escola_id, @aluno_nome, @titulo, @mensagem)
`);

let alertas = 0;
let altos = 0;
let notificacoes = 0;
let semAlerta = 0;
let jaTinham = 0;

const popular = db.transaction(() => {
  alunos.forEach((a, i) => {
    if (temAlerta.get(a.id)) { jaTinham++; return; }

    // Quantidade por aluno: ~20% ficam sem alerta; alguns com 2, a maioria 1.
    let qtd = 1;
    if (i % 5 === 4) qtd = 0;
    else if (i % 3 === 0) qtd = 2;
    if (qtd === 0) { semAlerta++; return; }

    for (let j = 0; j < qtd; j++) {
      const s = i * 2 + j;
      // Índices decorrelacionados (multiplicadores coprimos aos módulos) para o
      // eixo, o nível e o status não ficarem "presos" uns aos outros.
      const eixo = EIXOS[s % EIXOS.length];
      const nv = (s * 7) % 8;                 // ~1/4 alto, ~3/8 médio, ~3/8 baixo
      const nivel = nv < 2 ? 'alto' : nv < 5 ? 'medio' : 'baixo';
      // Status: altos tendem a ficar em aberto/andamento (severos no mapa);
      // os demais variam entre aberto/andamento/resolvido.
      const st = (s * 5) % 4;                 // 0,1→aberto · 2→andamento · 3→resolvido
      const status = nivel === 'alto'
        ? (s % 2 === 0 ? 'aberto' : 'em_andamento')
        : (st < 2 ? 'aberto' : st === 2 ? 'em_andamento' : 'resolvido');
      const titulo = TITULOS[eixo][s % TITULOS[eixo].length];
      // Data espalhada nos últimos ~6 meses (para o gráfico de evolução).
      const criado_em = dataFicticia(s);

      const { lastInsertRowid } = inserirAlerta.run({
        aluno_id: a.id, eixo, nivel, titulo,
        descricao: `Acompanhamento do(a) aluno(a) da turma ${a.turma}.`,
        status, criado_em,
      });
      inserirHist.run({ alerta_id: lastInsertRowid, status, criado_em });
      alertas++;

      if (nivel === 'alto') {
        altos++;
        if (status !== 'resolvido') {
          inserirNotif.run({
            alerta_id: lastInsertRowid, escola_id: a.escola_id, aluno_nome: a.nome,
            titulo: `Alerta de nível ALTO: ${titulo}`,
            mensagem: `Aluno(a): ${a.nome} · Eixo: ${eixo}.`,
          });
          notificacoes++;
        }
      }
    }
  });
});
popular();

console.log(
  `Alertas fictícios: ${alertas} criados (${altos} de nível ALTO), ` +
  `${notificacoes} notificação(ões) no feed. ` +
  `Alunos sem alerta (de propósito): ${semAlerta}. Já tinham alerta (pulados): ${jaTinham}.`
);
