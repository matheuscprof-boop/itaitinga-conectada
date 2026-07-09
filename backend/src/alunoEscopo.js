// Helper compartilhado pelas rotas dos eixos do aluno (Saúde/Assistência/Vida
// Escolar): carrega um aluno e confirma que está no escopo de escola do
// usuário. Retorna o aluno ou null (o chamador responde 404).

import db from './db.js';
import { podeAcessarAluno } from './escopo.js';

const obterAluno = db.prepare('SELECT id, nome, turma, sexo, escola_id FROM alunos WHERE id = ?');

export function alunoNoEscopo(req, id) {
  const aluno = obterAluno.get(id);
  if (!aluno || !podeAcessarAluno(req.usuario, aluno)) return null;
  return aluno;
}
