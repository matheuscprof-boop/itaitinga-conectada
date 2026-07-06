// Conexão única com o banco SQLite e criação automática do esquema.
// Usamos better-sqlite3 (API síncrona) por ser simples e legível — ideal
// para um MVP. Todo o restante do backend importa a instância `db` daqui.
//
// O caminho do banco pode ser definido por SAAE_DB:
//   - um caminho de arquivo  → persistente
//   - ':memory:'             → banco temporário (usado nos testes)
// Sem a variável, usa backend/data/saae.db.

import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrar } from './migracoes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let dbPath = process.env.SAAE_DB;
if (!dbPath) {
  const dataDir = join(__dirname, '..', 'data');
  mkdirSync(dataDir, { recursive: true });
  dbPath = join(dataDir, 'saae.db');
}

const db = new Database(dbPath);
if (dbPath !== ':memory:') db.pragma('journal_mode = WAL'); // melhor concorrência
db.pragma('foreign_keys = ON'); // garante os ON DELETE em cascata

// Cria as tabelas na primeira execução (idempotente).
const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);

// Ajusta bancos criados em versões anteriores (colunas/CHECK).
migrar(db);

export default db;
