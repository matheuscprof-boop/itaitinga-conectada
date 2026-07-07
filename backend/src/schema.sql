-- =====================================================================
-- Esquema do banco de dados — SAAE
-- Sistema de Acompanhamento e Alertas Estudantis
-- Banco: SQLite (arquivo único, sem servidor externo)
-- =====================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------
-- Tabela: escolas
-- Cada escola pertence a um município. Guarda coordenadas para o mapa.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS escolas (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nome       TEXT    NOT NULL,
  municipio  TEXT,
  endereco   TEXT,
  latitude   REAL,
  longitude  REAL,
  criado_em  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- Tabela: usuarios
-- Contas de acesso. O perfil define o nível de permissão; a "secretaria"
-- tem visão municipal (todas as escolas) e escola_id nulo.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nome        TEXT    NOT NULL,
  email       TEXT    NOT NULL UNIQUE,
  senha_hash  TEXT    NOT NULL,
  senha_salt  TEXT    NOT NULL,
  perfil      TEXT    NOT NULL DEFAULT 'professor'
                      CHECK (perfil IN ('professor', 'coordenacao', 'direcao', 'secretaria', 'secretaria_escolar', 'cidadao')),
  escola_id   INTEGER,   -- nulo para secretaria (municipal) e cidadão
  -- 'ativo' | 'pendente'. Contas de equipe autocadastradas nascem 'pendente'
  -- e só acessam dados de aluno após aprovação (salvaguarda LGPD).
  status      TEXT    NOT NULL DEFAULT 'ativo'
                      CHECK (status IN ('ativo', 'pendente')),
  -- Verificação de e-mail: contas criadas por um admin/seed nascem com 1;
  -- o autocadastro público nasce com 0 e confirma via código enviado por e-mail.
  email_verificado    INTEGER NOT NULL DEFAULT 1,
  codigo_verificacao  TEXT,               -- código de 6 dígitos (enquanto pendente)
  codigo_expira_em    INTEGER,            -- validade do código (epoch ms)
  cargo               TEXT,               -- cargo/função (equipe/gestão)
  matricula_funcional TEXT,               -- matrícula do servidor (equipe/gestão)
  criado_em   TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (escola_id) REFERENCES escolas(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------
-- Tabela: alunos
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alunos (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  escola_id             INTEGER,                   -- escola do aluno
  nome                  TEXT    NOT NULL,
  matricula             TEXT    NOT NULL UNIQUE,   -- identificador escolar único
  turma                 TEXT    NOT NULL,          -- ex.: "9º A"
  data_nascimento       TEXT,                      -- formato ISO: AAAA-MM-DD
  responsavel_nome      TEXT,
  responsavel_contato   TEXT,                      -- telefone ou e-mail
  observacoes           TEXT,
  criado_em             TEXT    NOT NULL DEFAULT (datetime('now')),
  atualizado_em         TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (escola_id) REFERENCES escolas(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------
-- Tabela: alertas
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alertas (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  aluno_id      INTEGER NOT NULL,
  eixo          TEXT    NOT NULL CHECK (eixo IN ('frequencia', 'desempenho', 'socioemocional')),
  nivel         TEXT    NOT NULL CHECK (nivel IN ('baixo', 'medio', 'alto')),
  titulo        TEXT    NOT NULL,
  descricao     TEXT,
  status        TEXT    NOT NULL DEFAULT 'aberto'
                        CHECK (status IN ('aberto', 'em_andamento', 'resolvido')),
  criado_em     TEXT    NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- Tabela: alerta_historico
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alerta_historico (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  alerta_id       INTEGER NOT NULL,
  tipo            TEXT    NOT NULL CHECK (tipo IN ('comentario', 'mudanca_status')),
  texto           TEXT,
  status_anterior TEXT,
  status_novo     TEXT,
  autor_id        INTEGER,
  autor_nome      TEXT,
  criado_em       TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (alerta_id) REFERENCES alertas(id) ON DELETE CASCADE,
  FOREIGN KEY (autor_id)  REFERENCES usuarios(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------
-- Tabela: notificacoes
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notificacoes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  alerta_id   INTEGER,
  escola_id   INTEGER,               -- escola relacionada (para o escopo)
  aluno_nome  TEXT,
  titulo      TEXT    NOT NULL,
  mensagem    TEXT,
  lida        INTEGER NOT NULL DEFAULT 0,
  criado_em   TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (alerta_id) REFERENCES alertas(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- Tabela: professor_turmas
-- Turmas pelas quais cada professor é responsável. Serve para direcionar as
-- notificações (por e-mail) ao professor da turma do aluno. O escopo de escola
-- vem do próprio professor (usuarios.escola_id).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS professor_turmas (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  professor_id INTEGER NOT NULL,
  turma        TEXT    NOT NULL,
  criado_em    TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (professor_id, turma),
  FOREIGN KEY (professor_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- =====================================================================
-- EIXO A — Saúde Escolar (dados por aluno)
-- =====================================================================

-- Dados 1:1 de saúde do aluno (vacinação e alergias).
CREATE TABLE IF NOT EXISTS saude_aluno (
  aluno_id         INTEGER PRIMARY KEY,      -- 1 registro por aluno
  vacinacao_status TEXT    NOT NULL DEFAULT 'pendente'
                           CHECK (vacinacao_status IN ('em_dia', 'pendente')),
  vacinas          TEXT,                     -- observações livres sobre vacinas
  alergias         TEXT,                     -- lista de alergias graves
  vacinas_tomadas          TEXT,             -- CSV de vacinas do checklist
  cartao_vacina            TEXT,             -- caminho do anexo (carteira de vacina)
  vacinacao_atualizada_em  TEXT,             -- data da última atualização da carteira
  doencas                  TEXT,             -- CSV de doenças pré-existentes
  doencas_outros           TEXT,             -- condições fora da lista (texto livre)
  usa_medicamento_controlado INTEGER NOT NULL DEFAULT 0,
  medicamentos             TEXT,             -- quais medicamentos controlados
  receita                  TEXT,             -- caminho do anexo (receita médica)
  atualizado_em    TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE
);

-- Registro diário de sintomas (N por aluno). Base do alerta automático por turma.
CREATE TABLE IF NOT EXISTS saude_sintomas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  aluno_id    INTEGER NOT NULL,
  data        TEXT    NOT NULL DEFAULT (date('now')),   -- AAAA-MM-DD
  sintomas    TEXT    NOT NULL,                          -- CSV (ex.: "febre,tosse")
  observacao  TEXT,
  autor_id    INTEGER,
  autor_nome  TEXT,
  criado_em   TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE,
  FOREIGN KEY (autor_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- =====================================================================
-- EIXO B — Assistência Social (dados por aluno)
-- =====================================================================

-- Áreas de risco mapeadas pelo município (círculo: centro + raio em km).
CREATE TABLE IF NOT EXISTS areas_risco (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  nome      TEXT    NOT NULL,
  latitude  REAL    NOT NULL,
  longitude REAL    NOT NULL,
  raio_km   REAL    NOT NULL DEFAULT 1.0,
  criado_em TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Dados 1:1 de assistência social do aluno.
CREATE TABLE IF NOT EXISTS assistencia_aluno (
  aluno_id           INTEGER PRIMARY KEY,     -- 1 registro por aluno
  bolsa_familia      INTEGER NOT NULL DEFAULT 0,   -- 0/1 beneficiário
  programas          TEXT,                    -- outros programas de auxílio
  composicao_familiar TEXT,                   -- descrição do núcleo familiar
  endereco           TEXT,                    -- endereço residencial (origem do GPS)
  latitude           REAL,                    -- geolocalização residencial
  longitude          REAL,
  em_area_risco      INTEGER NOT NULL DEFAULT 0,   -- 0/1 (calculado no cruzamento)
  atualizado_em      TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE
);

-- =====================================================================
-- EIXO C — Vida Escolar (dados por aluno)
-- =====================================================================

-- Dados 1:1 de vida escolar (frequência, desempenho, projetos).
CREATE TABLE IF NOT EXISTS vida_escolar_aluno (
  aluno_id             INTEGER PRIMARY KEY,   -- 1 registro por aluno
  frequencia_percentual REAL,                 -- 0–100
  desempenho_media     REAL,                  -- média geral (ex.: 0–10)
  projetos             TEXT,                  -- ex.: "Guardiões dos Biomas"
  observacoes          TEXT,
  pcd                  INTEGER NOT NULL DEFAULT 0,  -- 0/1: aluno com deficiência
  pcd_condicao         TEXT,                  -- qual a condição/deficiência
  pei                  TEXT,                  -- caminho do anexo (PEI: Plano Educacional Individualizado)
  atualizado_em        TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE
);

-- Diário de bordo: fotos do aluno (N por aluno).
CREATE TABLE IF NOT EXISTS logbook_fotos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  aluno_id   INTEGER NOT NULL,
  arquivo    TEXT    NOT NULL,               -- caminho relativo em /uploads
  legenda    TEXT,
  autor_nome TEXT,
  criado_em  TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE
);

-- Documentos do aluno (N por aluno): registros completos organizados por
-- categoria (saúde/social/escolar/outro). Aceita PDF e imagens.
CREATE TABLE IF NOT EXISTS aluno_documentos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  aluno_id      INTEGER NOT NULL,
  arquivo       TEXT    NOT NULL,            -- caminho relativo em /uploads
  nome_original TEXT,                        -- nome do arquivo enviado
  categoria     TEXT    NOT NULL DEFAULT 'outro'
                        CHECK (categoria IN ('saude', 'social', 'escolar', 'outro')),
  descricao     TEXT,
  autor_nome    TEXT,
  criado_em     TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE
);

-- =====================================================================
-- EIXO D — Infraestrutura e Cidadania (alertas de cidadãos)
-- =====================================================================

CREATE TABLE IF NOT EXISTS alertas_infra (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  categoria     TEXT    NOT NULL
                        CHECK (categoria IN ('iluminacao', 'buraco', 'lixo', 'saneamento', 'alagamento', 'outro')),
  descricao     TEXT    NOT NULL,
  foto          TEXT,                          -- caminho relativo em /uploads (opcional)
  latitude      REAL,
  longitude     REAL,
  anonimo       INTEGER NOT NULL DEFAULT 0,    -- 0/1
  cidadao_id    INTEGER,                       -- NULL quando anônimo
  status        TEXT    NOT NULL DEFAULT 'aberto'
                        CHECK (status IN ('aberto', 'em_andamento', 'resolvido')),
  criado_em     TEXT    NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (cidadao_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Índices para acelerar as consultas mais comuns.
CREATE INDEX IF NOT EXISTS idx_sintomas_aluno   ON saude_sintomas (aluno_id);
CREATE INDEX IF NOT EXISTS idx_sintomas_data    ON saude_sintomas (data);
CREATE INDEX IF NOT EXISTS idx_logbook_aluno    ON logbook_fotos (aluno_id);
CREATE INDEX IF NOT EXISTS idx_documentos_aluno ON aluno_documentos (aluno_id);
CREATE INDEX IF NOT EXISTS idx_infra_categoria  ON alertas_infra (categoria);
CREATE INDEX IF NOT EXISTS idx_infra_status     ON alertas_infra (status);
CREATE INDEX IF NOT EXISTS idx_alunos_escola    ON alunos (escola_id);
CREATE INDEX IF NOT EXISTS idx_alertas_aluno    ON alertas (aluno_id);
CREATE INDEX IF NOT EXISTS idx_alertas_eixo     ON alertas (eixo);
CREATE INDEX IF NOT EXISTS idx_alertas_status   ON alertas (status);
CREATE INDEX IF NOT EXISTS idx_historico_alerta ON alerta_historico (alerta_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_lida ON notificacoes (lida);
CREATE INDEX IF NOT EXISTS idx_notificacoes_escola ON notificacoes (escola_id);
CREATE INDEX IF NOT EXISTS idx_prof_turmas_prof  ON professor_turmas (professor_id);
CREATE INDEX IF NOT EXISTS idx_prof_turmas_turma ON professor_turmas (turma);
