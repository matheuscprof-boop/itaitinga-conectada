// Migrações idempotentes para bancos criados antes do suporte a múltiplas
// escolas. Recebe a instância `db` por parâmetro (evita import circular com
// db.js). Em bancos novos, nada é feito — o schema.sql já vem completo.

function colunas(db, tabela) {
  return db.prepare(`PRAGMA table_info(${tabela})`).all().map((c) => c.name);
}

function garantirColuna(db, tabela, coluna, definicao) {
  if (!colunas(db, tabela).includes(coluna)) {
    db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`);
  }
}

export function migrar(db) {
  // 1) Colunas de escola em tabelas antigas.
  garantirColuna(db, 'alunos', 'escola_id', 'INTEGER');
  garantirColuna(db, 'usuarios', 'escola_id', 'INTEGER');
  garantirColuna(db, 'notificacoes', 'escola_id', 'INTEGER');

  // 2) Coluna de situação da conta ('ativo'/'pendente') para bancos antigos.
  garantirColuna(db, 'usuarios', 'status', "TEXT NOT NULL DEFAULT 'ativo'");

  // 2b) Endereço residencial na assistência (origem da geolocalização por GPS).
  garantirColuna(db, 'assistencia_aluno', 'endereco', 'TEXT');

  // 2b2) Eixo Saúde: vacinação estruturada + anexos + doenças pré-existentes +
  //      medicamentos controlados.
  garantirColuna(db, 'saude_aluno', 'vacinas_tomadas', 'TEXT');
  garantirColuna(db, 'saude_aluno', 'cartao_vacina', 'TEXT');
  garantirColuna(db, 'saude_aluno', 'vacinacao_atualizada_em', 'TEXT');
  garantirColuna(db, 'saude_aluno', 'doencas', 'TEXT');
  garantirColuna(db, 'saude_aluno', 'doencas_outros', 'TEXT');
  garantirColuna(db, 'saude_aluno', 'usa_medicamento_controlado', 'INTEGER NOT NULL DEFAULT 0');
  garantirColuna(db, 'saude_aluno', 'medicamentos', 'TEXT');
  garantirColuna(db, 'saude_aluno', 'receita', 'TEXT');

  // 2c) Verificação de e-mail + dados de vínculo (equipe/gestão). O DEFAULT 1
  //     em email_verificado marca as contas já existentes como verificadas
  //     (para não trancar quem já usava o sistema); o autocadastro grava 0.
  garantirColuna(db, 'usuarios', 'email_verificado', 'INTEGER NOT NULL DEFAULT 1');
  garantirColuna(db, 'usuarios', 'codigo_verificacao', 'TEXT');
  garantirColuna(db, 'usuarios', 'codigo_expira_em', 'INTEGER');
  garantirColuna(db, 'usuarios', 'cargo', 'TEXT');
  garantirColuna(db, 'usuarios', 'matricula_funcional', 'TEXT');

  // 3) O CHECK do perfil precisa aceitar 'secretaria_escolar' e 'cidadao'. Se o
  //    banco antigo tem o CHECK sem algum desses valores, reconstruímos a tabela
  //    preservando os dados. (As colunas novas acima já existem neste ponto.)
  const linha = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='usuarios'")
    .get();
  if (linha && (!linha.sql.includes('secretaria_escolar') || !linha.sql.includes('cidadao'))) {
    reconstruirUsuarios(db);
  }

  // 4) O CHECK de categoria dos alertas de infraestrutura precisa aceitar
  //    'alagamento'. Reconstrói a tabela se um banco antigo não o tiver.
  const infra = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='alertas_infra'")
    .get();
  if (infra && !infra.sql.includes('alagamento')) {
    reconstruirAlertasInfra(db);
  }
}

function reconstruirAlertasInfra(db) {
  db.pragma('foreign_keys = OFF');
  const tx = db.transaction(() => {
    db.exec(`
      CREATE TABLE alertas_infra_novo (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        categoria     TEXT    NOT NULL
                              CHECK (categoria IN ('iluminacao','buraco','lixo','saneamento','alagamento','outro')),
        descricao     TEXT    NOT NULL,
        foto          TEXT,
        latitude      REAL,
        longitude     REAL,
        anonimo       INTEGER NOT NULL DEFAULT 0,
        cidadao_id    INTEGER,
        status        TEXT    NOT NULL DEFAULT 'aberto'
                              CHECK (status IN ('aberto','em_andamento','resolvido')),
        criado_em     TEXT    NOT NULL DEFAULT (datetime('now')),
        atualizado_em TEXT    NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (cidadao_id) REFERENCES usuarios(id) ON DELETE SET NULL
      );
    `);
    db.exec(`
      INSERT INTO alertas_infra_novo
        (id, categoria, descricao, foto, latitude, longitude, anonimo, cidadao_id, status, criado_em, atualizado_em)
      SELECT id, categoria, descricao, foto, latitude, longitude, anonimo, cidadao_id, status, criado_em, atualizado_em
      FROM alertas_infra;
    `);
    db.exec('DROP TABLE alertas_infra');
    db.exec('ALTER TABLE alertas_infra_novo RENAME TO alertas_infra');
    db.exec('CREATE INDEX IF NOT EXISTS idx_infra_categoria ON alertas_infra (categoria)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_infra_status ON alertas_infra (status)');
  });
  tx();
  db.pragma('foreign_keys = ON');
}

function reconstruirUsuarios(db) {
  // Alterar CHECK exige recriar a tabela (limitação do SQLite). As colunas
  // novas (email_verificado, cargo, etc.) já foram garantidas antes desta
  // chamada, então podemos copiá-las diretamente.
  db.pragma('foreign_keys = OFF');
  const tx = db.transaction(() => {
    db.exec(`
      CREATE TABLE usuarios_novo (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        nome        TEXT    NOT NULL,
        email       TEXT    NOT NULL UNIQUE,
        senha_hash  TEXT    NOT NULL,
        senha_salt  TEXT    NOT NULL,
        perfil      TEXT    NOT NULL DEFAULT 'professor'
                    CHECK (perfil IN ('professor','coordenacao','direcao','secretaria','secretaria_escolar','cidadao')),
        escola_id   INTEGER,
        status      TEXT    NOT NULL DEFAULT 'ativo'
                    CHECK (status IN ('ativo','pendente')),
        email_verificado    INTEGER NOT NULL DEFAULT 1,
        codigo_verificacao  TEXT,
        codigo_expira_em    INTEGER,
        cargo               TEXT,
        matricula_funcional TEXT,
        criado_em   TEXT    NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (escola_id) REFERENCES escolas(id) ON DELETE SET NULL
      );
    `);
    db.exec(`
      INSERT INTO usuarios_novo
        (id, nome, email, senha_hash, senha_salt, perfil, escola_id, status,
         email_verificado, codigo_verificacao, codigo_expira_em, cargo, matricula_funcional, criado_em)
      SELECT
         id, nome, email, senha_hash, senha_salt, perfil, escola_id, status,
         email_verificado, codigo_verificacao, codigo_expira_em, cargo, matricula_funcional, criado_em
      FROM usuarios;
    `);
    db.exec('DROP TABLE usuarios');
    db.exec('ALTER TABLE usuarios_novo RENAME TO usuarios');
  });
  tx();
  db.pragma('foreign_keys = ON');
}
