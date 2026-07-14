// Eixo A — Saúde Escolar (dados por aluno).
// Base: /api/saude
// Vacinação, alergias e registro diário de sintomas. O registro de sintomas
// dispara um alerta automático quando muitos alunos da mesma turma relatam
// sintomas semelhantes num curto período.

import { Router } from 'express';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import db from '../db.js';
import { VACINACAO_STATUS, VACINAS, DOENCAS_PREEXISTENTES, LIMITE_SINTOMAS } from '../constants.js';
import { alunoNoEscopo } from '../alunoEscopo.js';
import { notificar } from '../notificador.js';
import { uploadDocumento, caminhoPublico, UPLOADS_DIR } from '../uploads.js';

const router = Router();

const obterSaude = db.prepare('SELECT * FROM saude_aluno WHERE aluno_id = ?');
// Campos textuais/booleanos da aba Saúde. Anexos (cartão de vacina, receita) e a
// data de atualização da carteira ficam FORA deste upsert para não serem
// apagados quando o formulário é salvo sem reenviar o arquivo.
const upsertSaude = db.prepare(`
  INSERT INTO saude_aluno
    (aluno_id, vacinacao_status, vacinas, alergias,
     vacinas_tomadas, doencas, doencas_outros, usa_medicamento_controlado, medicamentos,
     peso, altura, gravidez, gravidez_historico, pre_natal,
     atualizado_em)
  VALUES
    (@aluno_id, @vacinacao_status, @vacinas, @alergias,
     @vacinas_tomadas, @doencas, @doencas_outros, @usa_medicamento_controlado, @medicamentos,
     @peso, @altura, @gravidez, @gravidez_historico, @pre_natal,
     datetime('now'))
  ON CONFLICT(aluno_id) DO UPDATE SET
    vacinacao_status = excluded.vacinacao_status,
    vacinas = excluded.vacinas,
    alergias = excluded.alergias,
    vacinas_tomadas = excluded.vacinas_tomadas,
    doencas = excluded.doencas,
    doencas_outros = excluded.doencas_outros,
    usa_medicamento_controlado = excluded.usa_medicamento_controlado,
    medicamentos = excluded.medicamentos,
    peso = excluded.peso,
    altura = excluded.altura,
    gravidez = excluded.gravidez,
    gravidez_historico = excluded.gravidez_historico,
    pre_natal = excluded.pre_natal,
    atualizado_em = datetime('now')
`);

// Grava só o caminho do cartão de vacina (carimba a data de atualização da
// carteira). Cria a linha se ainda não existir (usa os defaults do schema).
const salvarCartaoVacina = db.prepare(`
  INSERT INTO saude_aluno (aluno_id, cartao_vacina, vacinacao_atualizada_em, atualizado_em)
  VALUES (@aluno_id, @arquivo, datetime('now'), datetime('now'))
  ON CONFLICT(aluno_id) DO UPDATE SET
    cartao_vacina = excluded.cartao_vacina,
    vacinacao_atualizada_em = datetime('now'),
    atualizado_em = datetime('now')
`);
// Grava só o caminho da receita médica.
const salvarReceita = db.prepare(`
  INSERT INTO saude_aluno (aluno_id, receita, atualizado_em)
  VALUES (@aluno_id, @arquivo, datetime('now'))
  ON CONFLICT(aluno_id) DO UPDATE SET
    receita = excluded.receita,
    atualizado_em = datetime('now')
`);

const listarSintomas = db.prepare(
  'SELECT * FROM saude_sintomas WHERE aluno_id = ? ORDER BY criado_em DESC, id DESC LIMIT 50'
);
const inserirSintoma = db.prepare(`
  INSERT INTO saude_sintomas (aluno_id, data, sintomas, observacao, autor_id, autor_nome)
  VALUES (@aluno_id, @data, @sintomas, @observacao, @autor_id, @autor_nome)
`);
const sintomasRecentesDaTurma = db.prepare(`
  SELECT s.aluno_id, s.sintomas
  FROM saude_sintomas s
  JOIN alunos a ON a.id = s.aluno_id
  WHERE a.turma = @turma AND a.escola_id = @escola
    AND s.criado_em >= datetime('now', '-1 day')
`);

// Normaliza uma lista de sintomas ("Febre, Tosse") em tokens comparáveis.
function tokens(csv) {
  return (csv || '')
    .split(/[,;]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

// Converte um valor numérico (peso/altura) para número positivo ou null.
// Aceita vírgula decimal (ex.: "1,62" → 1.62). Zero/negativo/inválido → null.
function numeroPositivoOuNulo(v) {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Normaliza uma seleção de checklist (array ou CSV) mantendo só os valores
// permitidos, sem duplicatas, e devolve um CSV (ou null se vazio).
function normalizarLista(valor, permitidos) {
  const bruto = Array.isArray(valor)
    ? valor.map((t) => String(t).trim().toLowerCase())
    : tokens(valor);
  const set = new Set(permitidos);
  const filtrados = [...new Set(bruto)].filter((t) => set.has(t));
  return filtrados.length ? filtrados.join(',') : null;
}

// Remove o arquivo físico de um anexo antigo (ignora se já não existir).
async function removerArquivo(caminhoPub) {
  if (!caminhoPub) return;
  const nome = caminhoPub.replace(/^\/uploads\//, '');
  await unlink(join(UPLOADS_DIR, nome)).catch(() => {});
}

// Após registrar um sintoma, verifica se o limite por turma foi atingido.
function verificarSurto(aluno, novosSintomas) {
  const alvo = new Set(tokens(novosSintomas));
  if (alvo.size === 0) return null;

  const linhas = sintomasRecentesDaTurma.all({ turma: aluno.turma, escola: aluno.escola_id });
  const alunosAfetados = new Set();
  for (const l of linhas) {
    if (tokens(l.sintomas).some((t) => alvo.has(t))) alunosAfetados.add(l.aluno_id);
  }

  if (alunosAfetados.size >= LIMITE_SINTOMAS) {
    const sintomasTxt = [...alvo].join(', ');
    const titulo = `Possível surto na turma ${aluno.turma}`;
    const mensagem =
      `${alunosAfetados.size} aluno(s) da turma ${aluno.turma} relataram sintomas semelhantes ` +
      `(${sintomasTxt}) nas últimas 24h. Verifique a situação.`;
    notificar({ titulo, mensagem, escolaId: aluno.escola_id, turma: aluno.turma });
    return { alunos_afetados: alunosAfetados.size, sintomas: sintomasTxt };
  }
  return null;
}

// GET /api/saude/:alunoId → dados de saúde + sintomas recentes
router.get('/:alunoId', (req, res) => {
  const aluno = alunoNoEscopo(req, req.params.alunoId);
  if (!aluno) return res.status(404).json({ erro: 'Aluno não encontrado.' });
  const saude = obterSaude.get(aluno.id) || {
    aluno_id: aluno.id,
    vacinacao_status: 'pendente',
    vacinas: null,
    alergias: null,
    vacinas_tomadas: null,
    cartao_vacina: null,
    vacinacao_atualizada_em: null,
    doencas: null,
    doencas_outros: null,
    usa_medicamento_controlado: 0,
    medicamentos: null,
    receita: null,
    peso: null,
    altura: null,
    gravidez: 0,
    gravidez_historico: 0,
    pre_natal: 0,
  };
  saude.sintomas = listarSintomas.all(aluno.id);
  res.json(saude);
});

// PUT /api/saude/:alunoId → cria/atualiza vacinação e alergias
router.put('/:alunoId', (req, res) => {
  const aluno = alunoNoEscopo(req, req.params.alunoId);
  if (!aluno) return res.status(404).json({ erro: 'Aluno não encontrado.' });

  const vacinacao_status = req.body.vacinacao_status ?? 'pendente';
  if (!VACINACAO_STATUS.includes(vacinacao_status)) {
    return res.status(400).json({ erro: `Status de vacinação inválido. Use: ${VACINACAO_STATUS.join(', ')}.` });
  }
  const usaMedicamento = req.body.usa_medicamento_controlado ? 1 : 0;
  // Gestação só se aplica a alunas do sexo feminino — para os demais, zera.
  const feminino = aluno.sexo === 'feminino';
  const gravida = feminino && req.body.gravidez ? 1 : 0;
  upsertSaude.run({
    aluno_id: aluno.id,
    vacinacao_status,
    vacinas: req.body.vacinas || null,
    alergias: req.body.alergias || null,
    vacinas_tomadas: normalizarLista(req.body.vacinas_tomadas, VACINAS),
    doencas: normalizarLista(req.body.doencas, DOENCAS_PREEXISTENTES),
    doencas_outros: req.body.doencas_outros || null,
    usa_medicamento_controlado: usaMedicamento,
    // Só faz sentido guardar quais medicamentos se o aluno usa algum.
    medicamentos: usaMedicamento ? (req.body.medicamentos || null) : null,
    peso: numeroPositivoOuNulo(req.body.peso),
    altura: numeroPositivoOuNulo(req.body.altura),
    gravidez: gravida,
    gravidez_historico: feminino && req.body.gravidez_historico ? 1 : 0,
    // Pré-natal só faz sentido para gestante atual — fora disso, zera.
    pre_natal: gravida && req.body.pre_natal ? 1 : 0,
  });
  res.json(obterSaude.get(aluno.id));
});

// POST /api/saude/:alunoId/cartao-vacina → anexa a carteira de vacina (campo "arquivo")
router.post('/:alunoId/cartao-vacina', uploadDocumento, async (req, res) => {
  const aluno = alunoNoEscopo(req, req.params.alunoId);
  if (!aluno) return res.status(404).json({ erro: 'Aluno não encontrado.' });
  if (!req.file) return res.status(400).json({ erro: 'Envie um arquivo no campo "arquivo".' });

  const anterior = obterSaude.get(aluno.id)?.cartao_vacina;
  salvarCartaoVacina.run({ aluno_id: aluno.id, arquivo: caminhoPublico(req.file) });
  await removerArquivo(anterior); // remove o anexo substituído
  res.status(201).json(obterSaude.get(aluno.id));
});

// DELETE /api/saude/:alunoId/cartao-vacina → remove a carteira de vacina anexada
router.delete('/:alunoId/cartao-vacina', async (req, res) => {
  const aluno = alunoNoEscopo(req, req.params.alunoId);
  if (!aluno) return res.status(404).json({ erro: 'Aluno não encontrado.' });
  const atual = obterSaude.get(aluno.id)?.cartao_vacina;
  salvarCartaoVacina.run({ aluno_id: aluno.id, arquivo: null });
  await removerArquivo(atual);
  res.json(obterSaude.get(aluno.id));
});

// POST /api/saude/:alunoId/receita → anexa a receita médica (campo "arquivo")
router.post('/:alunoId/receita', uploadDocumento, async (req, res) => {
  const aluno = alunoNoEscopo(req, req.params.alunoId);
  if (!aluno) return res.status(404).json({ erro: 'Aluno não encontrado.' });
  if (!req.file) return res.status(400).json({ erro: 'Envie um arquivo no campo "arquivo".' });

  const anterior = obterSaude.get(aluno.id)?.receita;
  salvarReceita.run({ aluno_id: aluno.id, arquivo: caminhoPublico(req.file) });
  await removerArquivo(anterior);
  res.status(201).json(obterSaude.get(aluno.id));
});

// DELETE /api/saude/:alunoId/receita → remove a receita médica anexada
router.delete('/:alunoId/receita', async (req, res) => {
  const aluno = alunoNoEscopo(req, req.params.alunoId);
  if (!aluno) return res.status(404).json({ erro: 'Aluno não encontrado.' });
  const atual = obterSaude.get(aluno.id)?.receita;
  salvarReceita.run({ aluno_id: aluno.id, arquivo: null });
  await removerArquivo(atual);
  res.json(obterSaude.get(aluno.id));
});

// POST /api/saude/:alunoId/sintomas → registra sintomas do dia
router.post('/:alunoId/sintomas', (req, res) => {
  const aluno = alunoNoEscopo(req, req.params.alunoId);
  if (!aluno) return res.status(404).json({ erro: 'Aluno não encontrado.' });

  const sintomas = (req.body.sintomas ?? '').trim();
  if (!sintomas) return res.status(400).json({ erro: 'Informe ao menos um sintoma.' });

  const { lastInsertRowid } = inserirSintoma.run({
    aluno_id: aluno.id,
    data: req.body.data || new Date().toISOString().slice(0, 10),
    sintomas,
    observacao: req.body.observacao || null,
    autor_id: req.usuario?.id ?? null,
    autor_nome: req.usuario?.nome ?? null,
  });

  const surto = verificarSurto(aluno, sintomas);
  const criado = db.prepare('SELECT * FROM saude_sintomas WHERE id = ?').get(lastInsertRowid);
  res.status(201).json({ ...criado, surto });
});

// GET /api/saude/:alunoId/sintomas → histórico de sintomas
router.get('/:alunoId/sintomas', (req, res) => {
  const aluno = alunoNoEscopo(req, req.params.alunoId);
  if (!aluno) return res.status(404).json({ erro: 'Aluno não encontrado.' });
  res.json(listarSintomas.all(aluno.id));
});

export default router;
