// Cria um usuário administrador padrão quando a tabela de usuários está
// vazia — assim o sistema já pode ser acessado logo após a instalação
// (e os testes têm uma credencial conhecida para começar).

import db from './db.js';
import { gerarHashSenha } from './senha.js';

// Conta inicial com visão municipal (secretaria): cria escolas e usuários.
const ADMIN_PADRAO = {
  nome: 'Secretaria Municipal',
  email: 'admin@saae.local',
  senha: 'admin123',
  perfil: 'secretaria',
};

export function garantirAdminPadrao() {
  const { total } = db.prepare('SELECT COUNT(*) AS total FROM usuarios').get();
  if (total > 0) return;

  const { senha_hash, senha_salt } = gerarHashSenha(ADMIN_PADRAO.senha);
  db.prepare(
    `INSERT INTO usuarios (nome, email, senha_hash, senha_salt, perfil)
     VALUES (@nome, @email, @senha_hash, @senha_salt, @perfil)`
  ).run({
    nome: ADMIN_PADRAO.nome,
    email: ADMIN_PADRAO.email,
    senha_hash,
    senha_salt,
    perfil: ADMIN_PADRAO.perfil,
  });

  console.log(
    `[SAAE] Usuário administrador padrão criado — e-mail: ${ADMIN_PADRAO.email} / senha: ${ADMIN_PADRAO.senha} (troque após o primeiro acesso).`
  );
}
