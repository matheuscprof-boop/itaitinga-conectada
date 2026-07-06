// Constrói a cláusula WHERE dos alertas a partir dos parâmetros de consulta.
// Reutilizado pela listagem de alertas e pelos relatórios.
// Convenção de alias nas consultas: `al` = alertas, `a` = alunos.

export function montarFiltrosAlertas(query = {}) {
  const filtros = [];
  const params = {};

  for (const campo of ['eixo', 'nivel', 'status']) {
    if (query[campo]) {
      filtros.push(`al.${campo} = @${campo}`);
      params[campo] = query[campo];
    }
  }
  if (query.aluno_id) {
    filtros.push('al.aluno_id = @aluno_id');
    params.aluno_id = query.aluno_id;
  }
  if (query.turma) {
    filtros.push('a.turma = @turma');
    params.turma = query.turma;
  }
  if (query.escola_id) {
    filtros.push('a.escola_id = @escola_id');
    params.escola_id = query.escola_id;
  }
  // Período com base na data de criação (formato ISO AAAA-MM-DD).
  if (query.de) {
    filtros.push('date(al.criado_em) >= date(@de)');
    params.de = query.de;
  }
  if (query.ate) {
    filtros.push('date(al.criado_em) <= date(@ate)');
    params.ate = query.ate;
  }

  const where = filtros.length ? ` WHERE ${filtros.join(' AND ')}` : '';
  return { where, params };
}
