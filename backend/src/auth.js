// Autenticação por token assinado (HMAC-SHA256) e middlewares de permissão.
// Mantemos tudo com o `crypto` nativo — sem bibliotecas de JWT — para o MVP
// ficar simples e sem dependências extras.

import crypto from 'node:crypto';

const SEGREDO =
  process.env.SAAE_SEGREDO || 'segredo-de-desenvolvimento-troque-em-producao';

if (!process.env.SAAE_SEGREDO) {
  console.warn(
    '[SAAE] Aviso: SAAE_SEGREDO não definido — usando segredo padrão de desenvolvimento.'
  );
}

const VALIDADE_PADRAO = 8 * 60 * 60; // 8 horas em segundos

function agoraEmSegundos() {
  return Math.floor(Date.now() / 1000);
}

// Gera um token contendo os dados do usuário e a validade.
export function gerarToken(payload, validadeSegundos = VALIDADE_PADRAO) {
  const dados = { ...payload, exp: agoraEmSegundos() + validadeSegundos };
  const corpo = Buffer.from(JSON.stringify(dados)).toString('base64url');
  const assinatura = crypto
    .createHmac('sha256', SEGREDO)
    .update(corpo)
    .digest('base64url');
  return `${corpo}.${assinatura}`;
}

// Valida a assinatura e a expiração; retorna o payload ou null.
export function verificarToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [corpo, assinatura] = token.split('.');
  if (!corpo || !assinatura) return null;

  const esperada = crypto
    .createHmac('sha256', SEGREDO)
    .update(corpo)
    .digest('base64url');
  const a = Buffer.from(assinatura);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const dados = JSON.parse(Buffer.from(corpo, 'base64url').toString());
    if (!dados.exp || dados.exp < agoraEmSegundos()) return null;
    return dados;
  } catch {
    return null;
  }
}

// Middleware: exige um token válido no cabeçalho Authorization: Bearer <token>.
export function autenticar(req, res, next) {
  const cabecalho = req.headers.authorization || '';
  const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7) : null;
  const dados = verificarToken(token);
  if (!dados) {
    return res.status(401).json({ erro: 'Autenticação necessária ou sessão expirada.' });
  }
  req.usuario = dados; // { id, nome, perfil, exp }
  next();
}

// Middleware de fábrica: exige que o usuário tenha um dos perfis informados.
export function exigirPerfil(...perfis) {
  return (req, res, next) => {
    if (!req.usuario || !perfis.includes(req.usuario.perfil)) {
      return res
        .status(403)
        .json({ erro: 'Você não tem permissão para realizar esta ação.' });
    }
    next();
  };
}

// Middleware de fábrica: NEGA acesso aos perfis informados (lista de bloqueio).
// Usado para manter o cidadão fora das áreas de dados de aluno.
export function bloquearPerfil(...perfis) {
  return (req, res, next) => {
    if (req.usuario && perfis.includes(req.usuario.perfil)) {
      return res.status(403).json({ erro: 'Seu perfil não tem acesso a esta área.' });
    }
    next();
  };
}
