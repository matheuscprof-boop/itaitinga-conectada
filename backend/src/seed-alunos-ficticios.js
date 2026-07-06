// Cadastro de ALUNOS FICTÍCIOS distribuídos pelas escolas reais de Itaitinga.
// Uso:  npm run seed:alunos   (dentro da pasta backend)
//
// É IDEMPOTENTE (pula matrículas já existentes) e NÃO destrutivo. Serve para
// popular a aplicação com dados de demonstração após cadastrar as escolas reais
// (`npm run seed:escolas`). Matrícula no padrão 2026<escola:02d><seq:02d>.

import db from './db.js';

const PRIMEIROS = [
  'Ana', 'Beatriz', 'Bruno', 'Carla', 'Daniel', 'Eduarda', 'Felipe', 'Gabriel',
  'Helena', 'Igor', 'Júlia', 'Kauã', 'Larissa', 'Miguel', 'Natália', 'Otávio',
  'Paula', 'Rafael', 'Sofia', 'Thiago', 'Valentina', 'Yasmin', 'Enzo', 'Lívia',
  'Davi', 'Manuela', 'Lucas', 'Isadora', 'Pedro', 'Alice', 'Arthur', 'Cecília',
  'Heitor', 'Laura', 'Bernardo', 'Maria', 'Vinícius', 'Antônia',
];
const SOBRENOMES = [
  'Souza', 'Lima', 'Oliveira', 'Alves', 'Ferreira', 'Gomes', 'Rodrigues',
  'Santos', 'Costa', 'Pereira', 'Nascimento', 'Cavalcante', 'Barbosa', 'Moraes',
  'Sales', 'Teixeira', 'Freitas', 'Vasconcelos', 'Mendes', 'Rocha',
];
const RESP_PRIMEIROS = [
  'Marina', 'Carlos', 'Patrícia', 'Sônia', 'Roberto', 'Cláudia', 'Antônio',
  'Fernanda', 'José', 'Luciana', 'Marcos', 'Débora', 'Paulo', 'Adriana',
];
const TURMAS = ['6º A', '6º B', '7º A', '7º B', '8º A', '8º B', '9º A', '9º B'];

// Ano de nascimento aproximado por ano escolar (referência: 2026).
function nascimento(turma, seed) {
  const ano = Number(turma[0]); // 6, 7, 8, 9
  const anoNasc = 2026 - (ano + 5); // 6º→2015, 9º→2012
  const mes = String((seed % 12) + 1).padStart(2, '0');
  const dia = String((seed % 27) + 1).padStart(2, '0');
  return `${anoNasc}-${mes}-${dia}`;
}

function contato(seed) {
  const n = 90000000 + (seed * 137 % 9999999);
  const s = String(n);
  return `(85) 9${s.slice(0, 4)}-${s.slice(4, 8)}`;
}

const escolas = db
  .prepare("SELECT id, nome FROM escolas WHERE municipio = 'Itaitinga' ORDER BY id")
  .all();

if (escolas.length === 0) {
  console.error('Nenhuma escola de Itaitinga encontrada. Rode antes: npm run seed:escolas');
  process.exit(1);
}

const existeMatricula = db.prepare('SELECT 1 FROM alunos WHERE matricula = ?');
const inserir = db.prepare(`
  INSERT INTO alunos (escola_id, nome, matricula, turma, data_nascimento,
                      responsavel_nome, responsavel_contato, observacoes)
  VALUES (@escola_id, @nome, @matricula, @turma, @data_nascimento,
          @responsavel_nome, @responsavel_contato, @observacoes)
`);

const POR_ESCOLA = 4; // 2 turmas × 2 alunos

let inseridos = 0;
let existentes = 0;
const aplicar = db.transaction(() => {
  escolas.forEach((escola, i) => {
    // Duas turmas por escola; 2 alunos em cada (bom para agrupamentos/demos).
    const turmaA = TURMAS[(2 * i) % TURMAS.length];
    const turmaB = TURMAS[(2 * i + 1) % TURMAS.length];
    for (let j = 0; j < POR_ESCOLA; j++) {
      const seed = i * POR_ESCOLA + j;
      const turma = j < 2 ? turmaA : turmaB;
      const nome = `${PRIMEIROS[seed % PRIMEIROS.length]} ${SOBRENOMES[(seed * 3) % SOBRENOMES.length]}`;
      const matricula = `2026${String(i).padStart(2, '0')}${String(j + 1).padStart(2, '0')}`;
      if (existeMatricula.get(matricula)) {
        existentes++;
        continue;
      }
      const resp = `${RESP_PRIMEIROS[seed % RESP_PRIMEIROS.length]} ${SOBRENOMES[(seed * 3) % SOBRENOMES.length]}`;
      inserir.run({
        escola_id: escola.id,
        nome,
        matricula,
        turma,
        data_nascimento: nascimento(turma, seed),
        responsavel_nome: resp,
        responsavel_contato: contato(seed),
        observacoes: null,
      });
      inseridos++;
    }
  });
});
aplicar();

const total = db.prepare("SELECT COUNT(*) n FROM alunos").get().n;
console.log(
  `Alunos fictícios: ${inseridos} cadastrado(s), ${existentes} já existente(s) (pulados). ` +
  `Total de alunos no banco: ${total}, distribuídos por ${escolas.length} escolas.`
);
