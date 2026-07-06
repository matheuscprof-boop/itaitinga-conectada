// Utilitários de senha usando apenas o módulo nativo `crypto` (sem
// dependências externas). O algoritmo scrypt é resistente a força bruta.

import crypto from 'node:crypto';

// Gera hash + salt para armazenar. Nunca guardamos a senha em texto puro.
export function gerarHashSenha(senha) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(senha, salt, 64).toString('hex');
  return { senha_hash: hash, senha_salt: salt };
}

// Compara a senha informada com o hash guardado (comparação de tempo
// constante para evitar ataques de temporização).
export function verificarSenha(senha, hashGuardado, salt) {
  const calculado = crypto.scryptSync(senha, salt, 64);
  const guardado = Buffer.from(hashGuardado, 'hex');
  return (
    calculado.length === guardado.length &&
    crypto.timingSafeEqual(calculado, guardado)
  );
}
