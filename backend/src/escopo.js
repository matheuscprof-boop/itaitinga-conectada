// Regras de escopo por escola.
//
// - Perfil "secretaria" (municipal): enxerga TODAS as escolas; pode filtrar
//   por uma escola específica via ?escola_id=.
// - Demais perfis: ficam restritos à própria escola (req.usuario.escola_id).

import { PERFIL_MUNICIPAL } from './constants.js';

export function ehMunicipal(usuario) {
  return usuario?.perfil === PERFIL_MUNICIPAL;
}

// O usuário pode acessar este aluno? (municipal vê todos; demais, só a sua
// escola). Helper compartilhado pelas rotas de aluno e pelos eixos A/B/C.
export function podeAcessarAluno(usuario, aluno) {
  if (!aluno) return false;
  return ehMunicipal(usuario) || aluno.escola_id === usuario.escola_id;
}

// Retorna o escola_id efetivo para filtrar consultas:
//   número → filtra por aquela escola
//   null   → sem filtro (municipal vendo todas)
export function escolaEfetiva(req) {
  if (ehMunicipal(req.usuario)) {
    const q = req.query?.escola_id;
    return q ? Number(q) : null;
  }
  // Usuário de escola sempre restrito à sua; -1 nunca casa (proteção).
  return req.usuario?.escola_id ?? -1;
}

// Monta o objeto de filtros (para montarFiltrosAlertas) já com o escopo de
// escola aplicado, ignorando qualquer escola_id que o usuário tente forçar.
export function filtrosComEscola(req) {
  const escola = escolaEfetiva(req);
  const filtros = { ...req.query };
  if (escola == null) delete filtros.escola_id;
  else filtros.escola_id = escola;
  return filtros;
}
