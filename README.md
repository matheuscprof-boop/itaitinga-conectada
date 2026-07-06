# Itaitinga Conectada

MVP web que integra **acompanhamento estudantil** e **cidadania** no município de
Itaitinga. Reúne, por aluno, dados de **três eixos** — **Saúde Escolar**,
**Assistência Social** e **Vida Escolar** — e abre um quarto eixo de
**Infraestrutura e Cidadania**, onde qualquer cidadão registra e acompanha
problemas de infraestrutura no mapa.

> Base técnica herdada do SAAE (Sistema de Acompanhamento e Alertas Estudantis):
> mantém o sistema pedagógico de alertas em Frequência/Desempenho/Socioemocional e
> os identificadores internos (`saae_*`), agora expandido. O foco continua sendo um
> produto **funcional, simples e acessível**.

**Funcionalidades:**

- **Dados do aluno em 3 eixos** (novos): **Saúde** (vacinação, alergias, registro
  diário de sintomas com **alerta automático de surto por turma**), **Assistência
  Social** (Bolsa Família, composição familiar, geolocalização residencial **cruzada
  com áreas de risco**) e **Vida Escolar** (frequência, desempenho, projetos e um
  **Diário de Bordo** com upload de fotos).
- **Eixo de Infraestrutura/Cidadania** (novo): cidadãos registram alertas
  (categoria, descrição, **foto**, **geolocalização** por mapa e opção
  **anônima**) ou fazem uma **denúncia rápida com 1 clique** usando a
  **localização automática do dispositivo** (com permissão). Tudo visível
  publicamente num **mapa interativo (Leaflet + OSM)**; a Secretaria gerencia o
  status.
- **Módulo de Documentos** (novo): gestores escolares mantêm os registros do
  aluno organizados por categoria (Saúde/Social/Escolar), com upload de PDF e
  imagens.
- **RBAC** com 5 perfis (professor/coordenação/direção/secretaria/**cidadão**),
  **escopo por escola** e **autocadastro** por perfil (todas as contas nascem
  **ativas** e entram imediatamente; só a Secretaria não se autocadastra).
- **Herdadas do SAAE:** múltiplas escolas, mapa das escolas, CRUD de alunos,
  alertas com **linha do tempo**, **relatórios** (CSV/PDF), **Painel Analítico**
  (barras/rosca/linha/heatmap), notificações, gestão de escolas/usuários e troca
  de senha.
- **Testes automatizados** de API (`node:test`) e de componentes (Vitest).

---

## Sumário

- [Arquitetura e tecnologias](#arquitetura-e-tecnologias)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Pré-requisitos](#pré-requisitos)
- [Como executar](#como-executar)
- [Perfis e permissões](#perfis-e-permissões)
- [Modelo de dados](#modelo-de-dados)
- [Rotas da API](#rotas-da-api)
- [Componentes de interface](#componentes-de-interface)
- [Testes](#testes)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Próximos passos](#próximos-passos)

---

## Arquitetura e tecnologias

| Camada    | Tecnologia                        | Por quê |
|-----------|-----------------------------------|---------|
| Backend   | Node.js + Express                 | API REST simples e legível |
| Banco     | SQLite (via `better-sqlite3`)     | Arquivo único, sem servidor externo — ideal para MVP |
| Frontend  | React + Vite                      | Componentização clara e recarga rápida |
| Autenticação | Token assinado (HMAC) + senha com scrypt | Usa só o `crypto` nativo, sem dependências extras |
| Testes    | `node:test` (runner nativo)       | Sem bibliotecas adicionais |

O frontend conversa com o backend por chamadas HTTP a `/api/*`. Em
desenvolvimento, o Vite encaminha essas chamadas para o Express (porta 3001),
evitando configuração de CORS. As rotas de alunos, alertas e relatórios exigem
um **token** (enviado em `Authorization: Bearer <token>`).

---

## Estrutura de pastas

```
saae/
├── README.md
├── package.json              # scripts utilitários (raiz)
├── .gitignore
├── docs/
│   └── exemplo-dados.json     # exemplo de payload / estrutura de dados
│
├── backend/
│   ├── package.json
│   ├── test/
│   │   └── api.test.js        # testes de integração da API (node:test)
│   └── src/
│       ├── server.js          # Express: monta rotas, protege as privadas, exporta o app
│       ├── db.js              # conexão SQLite + criação do esquema
│       ├── schema.sql         # esquema (usuarios, alunos, alertas, alerta_historico)
│       ├── constants.js       # eixos, níveis, status e perfis válidos
│       ├── senha.js           # hash/verificação de senha (scrypt)
│       ├── auth.js            # token assinado + middlewares de autenticação/perfil
│       ├── escopo.js          # regras de escopo por escola
│       ├── migracoes.js       # migrações idempotentes (bancos antigos)
│       ├── bootstrap.js       # cria a conta da Secretaria na primeira execução
│       ├── filtros.js         # monta o WHERE dos alertas (compartilhado)
│       ├── notificador.js     # gera notificações (ponto de extensão p/ e-mail)
│       ├── seed.js            # popula dados de exemplo
│       └── routes/
│           ├── auth.js        # login, /me, senha e gestão de usuários
│           ├── escolas.js     # CRUD de escolas (Secretaria)
│           ├── alunos.js      # CRUD de alunos + turmas (escopado)
│           ├── alertas.js     # alertas + histórico (linha do tempo)
│           ├── relatorios.js  # resumo, CSV, série, matriz e mapa
│           └── notificacoes.js # feed de notificações da gestão
│
└── frontend/
    ├── package.json
    ├── index.html
    ├── vite.config.js         # proxy /api → backend
    ├── vitest.config.js       # config dos testes de componentes
    └── src/
        ├── test/setup.js      # matchers do Testing Library
        ├── main.jsx
        ├── App.jsx            # autenticação + navegação (painel/detalhe/relatórios)
        ├── api.js             # camada de acesso à API, token e rótulos
        ├── styles.css         # estilos acessíveis
        ├── components/
        │   ├── Badge.jsx       # selo de eixo/nível/status/perfil
        │   ├── BarChart.jsx    # gráfico de barras (CSS puro)
        │   ├── DonutChart.jsx  # gráfico de rosca (SVG)
        │   ├── LineChart.jsx   # gráfico de linha / evolução (SVG)
        │   ├── Heatmap.jsx     # mapa de calor / mapeamento cruzado
        │   ├── MapaEscolas.jsx # mapa geográfico das escolas (SVG)
        │   ├── PaletaGraficos.js # paleta de cores dos gráficos
        │   ├── FiltrosAlertas.jsx # filtros reutilizáveis (Relatórios/Análises)
        │   ├── AlunoForm.jsx   # formulário de aluno
        │   ├── AlunoList.jsx   # lista de alunos com busca
        │   ├── AlunoCard.jsx   # cartão de informações do aluno
        │   ├── AlertaForm.jsx  # formulário de alerta
        │   ├── AlertaList.jsx  # alertas por eixo + linha do tempo/comentários
        │   └── *.test.jsx      # testes (Badge, BarChart, DonutChart, Heatmap)
        └── pages/
            ├── Login.jsx         # tela de acesso
            ├── Dashboard.jsx     # painel: resumo + lista + cadastro
            ├── AlunoDetalhe.jsx  # detalhe do aluno + alertas
            ├── Relatorios.jsx    # filtros, agregados, gráficos, CSV e PDF
            ├── Analitico.jsx     # Painel Analítico (distribuição/evolução/mapeamento)
            ├── Mapa.jsx          # mapa geográfico das escolas
            ├── Escolas.jsx       # gestão de escolas (Secretaria)
            ├── Usuarios.jsx      # gestão de usuários (Direção/Secretaria)
            ├── Notificacoes.jsx  # feed de notificações (gestão)
            └── MinhaConta.jsx    # dados do usuário + troca de senha
```

---

## Pré-requisitos

- **Node.js 18 ou superior** (recomendado 20+). Verifique com `node -v`.
- **npm** (acompanha o Node).

---

## Como executar

> No Windows, use dois terminais (PowerShell): um para o backend e outro para o
> frontend.

### 1. Instalar as dependências

Na pasta raiz `saae/`:

```powershell
npm run install:all
```

> Alternativa manual: `npm install` dentro de `backend/` e de `frontend/`.

### 2. (Opcional) Popular dados de exemplo

```powershell
npm run seed
```

Isso cria 3 alunos e alguns alertas para você já ver a tela preenchida.

Para cadastrar as **escolas municipais reais de Itaitinga** (Ensino Fundamental
II) — sem apagar nada, de forma **idempotente** —, rode:

```powershell
npm run seed:escolas
```

São 18 escolas com coordenadas do **OpenStreetMap**: 9 com o ponto exato do
prédio, 6 no centroide do bairro (aproximadas), 2 no logradouro (rua certa,
número aproximado) e apenas 1 sem referência no OSM (Horácio Alves Ferreira —
endereço conhecido, mas a via não está no OSM, então fica no centro do município
marcada "GPS a confirmar"). Ajuste esse ponto quando tiver o GPS oficial. O
script pula escolas já cadastradas (comparando pelo nome).

Para popular com **alunos fictícios** distribuídos pelas escolas reais (útil
para demonstração), rode depois:

```powershell
npm run seed:alunos
```

Cria ~72 alunos (2 turmas por escola, Fundamental II) de forma **idempotente**
(pula matrículas já existentes) e **não destrutiva**.

E para gerar **alertas fictícios** (preenchem mapa, dashboard e painel analítico
com os 3 eixos, níveis e status variados; ~1/4 de nível alto geram notificação):

```powershell
npm run seed:alertas
```

Idempotente (pula alunos que já têm algum alerta) e deixa ~20% dos alunos sem
alerta de propósito.

> ⚠️ **Atenção:** `npm run seed` **reinicia os dados de exemplo e apaga TODAS as
> escolas** (inclusive as reais cadastradas por `seed:escolas`), recriando as
> escolas/alunos fictícios de demonstração. Em um banco com dados reais, **não
> rode `npm run seed`** — use apenas `seed:escolas` e `seed:alunos`. Se rodar o
> seed de demo, execute esses dois em seguida para recadastrar os dados reais.

### 3. Subir o backend (terminal 1)

```powershell
npm run dev:backend
```

A API sobe em **http://localhost:3001**. Teste: http://localhost:3001/api/health

### 4. Subir o frontend (terminal 2)

```powershell
npm run dev:frontend
```

A interface abre em **http://localhost:5173**.

### 5. Acessar

Na primeira execução, o sistema cria a conta da **Secretaria Municipal** (visão
de todas as escolas):

- **E-mail:** `admin@saae.local`
- **Senha:** `admin123`

> Entre como Secretaria para **cadastrar escolas** (aba _Escolas_) e criar os
> usuários de cada escola. Troque a senha assim que possível.
> O comando `npm run seed` já cria **3 escolas** (com coordenadas em Itaitinga),
> alunos com dados dos 3 eixos, áreas de risco, alertas de infraestrutura e
> usuários de exemplo: `helena@saae.local` / `prof123` (professor),
> `marcos@saae.local` / `coord123` (coordenação),
> `joana@saae.local` / `dir123` (direção) e
> `cidadao@itaitinga.gov` / `cidadao123` (**cidadão** — eixo de infraestrutura).

### 6. Rodar os testes (opcional)

```powershell
npm test --prefix backend
```

---

## Perfis e permissões

Cada perfil de equipe (exceto a Secretaria) fica **restrito à sua escola**. A
**Secretaria Municipal** tem visão de **todas as escolas**. O **Cidadão** não
acessa nenhum dado de aluno — apenas o eixo de Infraestrutura.

| Ação                                   | Professor | Coordenação | Direção | Secretaria | Cidadão |
|----------------------------------------|:---------:|:-----------:|:-------:|:----------:|:-------:|
| Consultar alunos e alertas             | ✅ | ✅ | ✅ | ✅ | — |
| Registrar alertas e comentar           | ✅ | ✅ | ✅ | ✅ | — |
| Ver/editar eixos Saúde/Assistência/Vida Escolar | ✅ | ✅ | ✅ | ✅ | — |
| Ver documentos do aluno                | ✅ | ✅ | ✅ | ✅ | — |
| Enviar/remover documentos do aluno     | — | ✅ | ✅ | ✅ | — |
| Cadastrar/editar/remover alunos        | — | ✅ | ✅ | ✅ | — |
| Remover alertas                        | — | ✅ | ✅ | ✅ | — |
| Ver notificações (surto/risco/nível alto) | — | ✅ | ✅ | ✅ | — |
| Gerenciar usuários                     | — | — | ✅ (da sua escola) | ✅ (todas) | — |
| Gerenciar escolas / ver mapa municipal | — | — | — | ✅ | — |
| **Ver** alertas de infraestrutura      | ✅ | ✅ | ✅ | ✅ | ✅ (e público) |
| **Registrar** alerta de infraestrutura | — | — | — | — | ✅ |
| **Gerenciar status** de infraestrutura | — | — | — | ✅ | — |
| Escopo de visão                        | 1 escola | 1 escola | 1 escola | todas | — |

### Autocadastro

Qualquer pessoa pode criar conta em **Criar conta** (a partir do login). Todas as
contas nascem **ativas** e entram imediatamente:

- **Cidadão** → registra e vê alertas de infraestrutura.
- **Professor/Coordenação/Direção** → deve escolher uma escola (define o escopo).
- **Secretaria** → **não** pode ser criada por autocadastro (só por outro admin).

---

## Modelo de dados

Definição completa em `backend/src/schema.sql`; exemplo de payload em
`docs/exemplo-dados.json`.

### `escolas`

| Campo       | Tipo    | Observação                          |
|-------------|---------|-------------------------------------|
| id          | INTEGER | PK, autoincremento                  |
| nome        | TEXT    | obrigatório                         |
| municipio   | TEXT    | opcional                            |
| endereco    | TEXT    | opcional                            |
| latitude / longitude | REAL | coordenadas para o mapa        |
| criado_em   | TEXT    | preenchido automaticamente          |

### `usuarios`

| Campo       | Tipo    | Observação                                   |
|-------------|---------|----------------------------------------------|
| id          | INTEGER | PK, autoincremento                           |
| nome        | TEXT    | obrigatório                                  |
| email       | TEXT    | obrigatório, **único**                       |
| senha_hash / senha_salt | TEXT | senha protegida com scrypt (nunca em texto puro) |
| perfil      | TEXT    | `professor` \| `coordenacao` \| `direcao` \| `secretaria` \| `cidadao` |
| escola_id   | INTEGER | FK → `escolas.id` (nulo para Secretaria e Cidadão) |
| status      | TEXT    | `ativo` \| `pendente` (reservado; hoje todas as contas nascem `ativo`) |
| criado_em   | TEXT    | preenchido automaticamente                   |

### `professor_turmas`

Turmas pelas quais cada professor é responsável (direciona as notificações por
e-mail). O escopo de escola vem do próprio professor (`usuarios.escola_id`).

| Campo        | Tipo    | Observação                                  |
|--------------|---------|---------------------------------------------|
| id           | INTEGER | PK, autoincremento                          |
| professor_id | INTEGER | FK → `usuarios.id` (apaga em cascata)        |
| turma        | TEXT    | ex.: "9º A" — único por professor            |
| criado_em    | TEXT    | preenchido automaticamente                   |

### `alunos`

| Campo                 | Tipo    | Observação                     |
|-----------------------|---------|--------------------------------|
| id                    | INTEGER | PK, autoincremento             |
| escola_id             | INTEGER | FK → `escolas.id`              |
| nome                  | TEXT    | obrigatório                    |
| matricula             | TEXT    | obrigatório, **único**         |
| turma                 | TEXT    | obrigatório (ex.: "9º A")      |
| data_nascimento       | TEXT    | ISO `AAAA-MM-DD` (opcional)    |
| responsavel_nome      | TEXT    | opcional                       |
| responsavel_contato   | TEXT    | telefone ou e-mail (opcional)  |
| observacoes           | TEXT    | opcional                       |
| criado_em / atualizado_em | TEXT | preenchidos automaticamente   |

### `alertas`

| Campo         | Tipo    | Observação                                             |
|---------------|---------|--------------------------------------------------------|
| id            | INTEGER | PK, autoincremento                                     |
| aluno_id      | INTEGER | FK → `alunos.id` (apaga em cascata)                    |
| eixo          | TEXT    | `frequencia` \| `desempenho` \| `socioemocional`       |
| nivel         | TEXT    | `baixo` \| `medio` \| `alto`                           |
| titulo        | TEXT    | obrigatório                                            |
| descricao     | TEXT    | opcional                                               |
| status        | TEXT    | `aberto` \| `em_andamento` \| `resolvido`              |
| criado_em / atualizado_em | TEXT | preenchidos automaticamente               |

### `alerta_historico`

| Campo           | Tipo    | Observação                                          |
|-----------------|---------|-----------------------------------------------------|
| id              | INTEGER | PK, autoincremento                                  |
| alerta_id       | INTEGER | FK → `alertas.id` (apaga em cascata)                |
| tipo            | TEXT    | `comentario` \| `mudanca_status`                    |
| texto           | TEXT    | conteúdo do comentário (quando houver)              |
| status_anterior / status_novo | TEXT | preenchidos em mudanças de status      |
| autor_id / autor_nome | —  | usuário que gerou o registro                        |
| criado_em       | TEXT    | preenchido automaticamente                          |

### `notificacoes`

| Campo       | Tipo    | Observação                                       |
|-------------|---------|--------------------------------------------------|
| id          | INTEGER | PK, autoincremento                               |
| alerta_id   | INTEGER | FK → `alertas.id` (apaga em cascata), opcional   |
| aluno_nome  | TEXT    | nome do aluno relacionado                        |
| titulo / mensagem | TEXT | conteúdo do aviso                             |
| lida        | INTEGER | `0` não lida, `1` lida                           |
| criado_em   | TEXT    | preenchido automaticamente                       |

### Eixos do aluno (novos)

- **`saude_aluno`** (1 por aluno) — `vacinacao_status` (`em_dia`/`pendente`),
  `vacinas`, `alergias`.
- **`saude_sintomas`** (N por aluno) — registro diário (`data`, `sintomas` CSV,
  `observacao`, autor). Base do alerta automático de surto por turma.
- **`assistencia_aluno`** (1 por aluno) — `bolsa_familia`, `programas`,
  `composicao_familiar`, `endereco`, `latitude`/`longitude`, `em_area_risco`
  (calculado). A localização é definida pelo **endereço** (geocodificado em
  lat/long) ou pelo **GPS** do dispositivo — não se digita coordenada na mão.
- **`areas_risco`** — áreas mapeadas pelo município (`latitude`, `longitude`,
  `raio_km`) para o cruzamento geográfico (Haversine).
- **`vida_escolar_aluno`** (1 por aluno) — `frequencia_percentual`,
  `desempenho_media`, `projetos`, `observacoes`.
- **`logbook_fotos`** (N por aluno) — Diário de Bordo: `arquivo` (caminho em
  `/uploads`), `legenda`, autor.
- **`aluno_documentos`** (N por aluno) — módulo de Documentos: `arquivo`,
  `nome_original`, `categoria` (`saude`/`social`/`escolar`/`outro`), `descricao`,
  autor. Aceita PDF, imagens e textos; gerido pelos gestores escolares.

### Infraestrutura (`alertas_infra`)

| Campo       | Tipo    | Observação                                              |
|-------------|---------|---------------------------------------------------------|
| id          | INTEGER | PK, autoincremento                                      |
| categoria   | TEXT    | `iluminacao` \| `buraco` \| `lixo` \| `saneamento` \| `outro` |
| descricao   | TEXT    | obrigatório                                             |
| foto        | TEXT    | caminho em `/uploads` (opcional)                        |
| latitude / longitude | REAL | geolocalização informada pelo cidadão              |
| anonimo     | INTEGER | `0`/`1`                                                 |
| cidadao_id  | INTEGER | FK → `usuarios.id`; **NULL quando anônimo** (nunca exposto) |
| status      | TEXT    | `aberto` \| `em_andamento` \| `resolvido`               |
| criado_em / atualizado_em | TEXT | preenchidos automaticamente               |

---

## Rotas da API

Base: `http://localhost:3001/api`

> As rotas de **alunos**, **alertas** e **relatórios** exigem o cabeçalho
> `Authorization: Bearer <token>`, obtido no login.

### Públicas

| Método | Rota           | Descrição                                  |
|--------|----------------|--------------------------------------------|
| GET    | `/health`      | Verifica se a API está no ar               |
| GET    | `/referencias` | Eixos, níveis, status, perfis e categorias de infraestrutura |
| GET    | `/escolas-publicas` | Lista mínima (id + nome) para o autocadastro |
| POST   | `/auth/login`  | Autentica e devolve `{ token, usuario }`   |
| POST   | `/auth/registro` | Autocadastro por perfil (todas as contas nascem ativas) |
| GET    | `/infra/alertas` | Lista pública de alertas de infraestrutura (sem `cidadao_id`) |
| GET    | `/infra/alertas/:id` | Detalhe público de um alerta            |

### Autenticação e usuários

| Método | Rota                  | Perfil   | Descrição                        |
|--------|-----------------------|----------|----------------------------------|
| GET    | `/auth/me`            | qualquer | Dados do usuário autenticado     |
| PATCH  | `/auth/senha`         | qualquer | Troca a própria senha            |
| GET    | `/auth/usuarios`      | direção  | Lista usuários                   |
| POST   | `/auth/usuarios`      | direção  | Cria usuário                     |
| PUT    | `/auth/usuarios/:id`  | direção  | Edita usuário (nome/e-mail/perfil/senha) |
| DELETE | `/auth/usuarios/:id`  | direção  | Remove usuário                   |
| GET    | `/auth/usuarios/:id/turmas` | direção | Turmas de responsabilidade do professor |
| PUT    | `/auth/usuarios/:id/turmas` | direção | Define as turmas do professor (direciona os e-mails) |

### Escolas

| Método | Rota            | Perfil      | Descrição                              |
|--------|-----------------|-------------|----------------------------------------|
| GET    | `/escolas`      | qualquer    | Lista escolas (secretaria: todas; demais: a sua) |
| GET    | `/escolas/:id`  | escopo      | Detalhe de uma escola                  |
| POST   | `/escolas`      | secretaria  | Cria escola                            |
| PUT    | `/escolas/:id`  | secretaria  | Atualiza escola                        |
| DELETE | `/escolas/:id`  | secretaria  | Remove escola                         |

### Alunos

| Método | Rota            | Perfil        | Descrição                              |
|--------|-----------------|---------------|----------------------------------------|
| GET    | `/alunos?q=`    | qualquer      | Lista alunos (busca, **escopada por escola**) |
| GET    | `/alunos/turmas`| qualquer      | Lista de turmas (para filtros)         |
| GET    | `/alunos/:id`   | qualquer      | Retorna um aluno **com seus alertas**  |
| POST   | `/alunos`       | coord/direção | Cria um aluno                          |
| PUT    | `/alunos/:id`   | coord/direção | Atualiza um aluno                      |
| DELETE | `/alunos/:id`   | coord/direção | Remove um aluno (e seus alertas)       |

### Alertas e histórico

| Método | Rota                                          | Perfil        | Descrição                            |
|--------|-----------------------------------------------|---------------|--------------------------------------|
| GET    | `/alertas?eixo=&nivel=&status=&turma=&de=&ate=&aluno_id=` | qualquer | Lista com filtros combináveis |
| GET    | `/alertas/resumo`                             | qualquer      | Total de alertas abertos por eixo    |
| POST   | `/alertas`                                    | qualquer      | Registra um alerta                   |
| PATCH  | `/alertas/:id`                                | qualquer      | Atualiza o **status** (gera histórico) |
| DELETE | `/alertas/:id`                                | coord/direção | Remove um alerta                     |
| GET    | `/alertas/:id/historico`                      | qualquer      | Linha do tempo do alerta             |
| POST   | `/alertas/:id/historico`                      | qualquer      | Adiciona um comentário               |

### Eixos do aluno (equipe; **cidadão bloqueado**)

| Método | Rota                                  | Descrição                                        |
|--------|---------------------------------------|--------------------------------------------------|
| GET/PUT | `/saude/:alunoId`                    | Lê/grava vacinação e alergias                    |
| GET/POST | `/saude/:alunoId/sintomas`          | Histórico e registro de sintomas (dispara surto) |
| GET/PUT | `/assistencia/:alunoId`              | Lê/grava assistência (inclui `endereco`; recalcula área de risco) |
| GET    | `/assistencia/areas/risco`            | Lista as áreas de risco (para o mapa)            |
| GET    | `/geo/geocodificar?endereco=`         | Converte um endereço em latitude/longitude (via OSM/Nominatim, no servidor) |
| GET/PUT | `/vida-escolar/:alunoId`             | Lê/grava frequência, desempenho e projetos       |
| GET/POST | `/vida-escolar/:alunoId/fotos`      | Galeria e upload (multipart) do Diário de Bordo  |
| DELETE | `/vida-escolar/fotos/:fotoId`         | Remove uma foto do diário                        |
| GET    | `/documentos/:alunoId`                | Lista os documentos (qualquer equipe no escopo)  |
| POST   | `/documentos/:alunoId`                | Envia um documento — multipart (**só gestão**)   |
| DELETE | `/documentos/:docId`                  | Remove um documento (**só gestão**)              |

### Infraestrutura (eixo D)

| Método | Rota                     | Perfil     | Descrição                                     |
|--------|--------------------------|------------|-----------------------------------------------|
| GET    | `/infra/alertas`         | público    | Lista (filtros `categoria`/`status`)          |
| GET    | `/infra/alertas/:id`     | público    | Detalhe                                        |
| POST   | `/infra/alertas`         | cidadão    | Registra (multipart; **descrição opcional** → usa o rótulo da categoria na denúncia rápida; `anonimo` não vincula id) |
| PATCH  | `/infra/alertas/:id`     | secretaria | Atualiza o status                             |

### Relatórios

| Método | Rota                                       | Descrição                                 |
|--------|--------------------------------------------|-------------------------------------------|
| GET    | `/relatorios/resumo?<filtros>`             | Agregados por eixo, nível, status e turma |
| GET    | `/relatorios/alertas.csv?<filtros>`        | Exporta os alertas filtrados em CSV       |
| GET    | `/relatorios/serie?dimensao=<d>&<filtros>` | Contagem agrupada por 1 dimensão (barras/rosca/linha) |
| GET    | `/relatorios/matriz?linha=<a>&coluna=<b>&<filtros>` | Tabela cruzada (mapeamento/heatmap) |
| GET    | `/relatorios/mapa`                         | Por escola: coordenadas + contagem de alertas (mapa) |

> `dimensao`/`linha`/`coluna` aceitam: `eixo`, `nivel`, `status`, `turma`, `mes`
> e, para a Secretaria, `escola`. Todos os relatórios respeitam o escopo de
> escola do usuário.

### Notificações (coordenação/direção)

| Método | Rota                                | Descrição                                  |
|--------|-------------------------------------|--------------------------------------------|
| GET    | `/notificacoes?nao_lidas=1`         | Lista notificações + contagem de não lidas |
| PATCH  | `/notificacoes/:id`                 | Marca uma notificação como lida            |
| POST   | `/notificacoes/marcar-todas-lidas`  | Marca todas como lidas                     |

### Exemplos com `curl`

```bash
# 1) Login → guarde o token retornado
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@saae.local","senha":"admin123"}'

# 2) Criar aluno (usando o token)
curl -X POST http://localhost:3001/api/alunos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -d '{"nome":"João Pedro","matricula":"2025010","turma":"7º C"}'

# 3) Registrar alerta
curl -X POST http://localhost:3001/api/alertas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -d '{"aluno_id":1,"eixo":"desempenho","nivel":"alto","titulo":"Notas baixas em 3 disciplinas"}'
```

---

## Componentes de interface

Cada eixo é representado por formulários, listas e cartões reutilizáveis:

- **Formulários** — `AlunoForm` (cadastro/edição), `AlertaForm` (registro de
  alerta com eixo e nível) e `Login` (acesso).
- **Listas** — `AlunoList` (com busca) e `AlertaList` (alertas **agrupados por
  eixo**, com fluxo de status e **linha do tempo** de comentários/mudanças).
- **Cartões de informação** — `AlunoCard` (dados do aluno) e os cartões de
  métrica no painel e nos relatórios.
- **Relatórios** — `Relatorios` com filtros combináveis, agregados, **gráficos
  de barras** (`BarChart`), exportação **CSV** e **impressão/PDF**.
- **Painel Analítico** — `Analitico` (disponível a todos os perfis): escolha a
  dimensão para **agrupar** (eixo, nível, status, turma, mês e — para a Secretaria
  — **escola**), alterne entre **barras** e **rosca**, veja a **evolução no
  tempo** (linha) e um **mapeamento** cruzado em **mapa de calor** (`Heatmap`).
- **Mapa geográfico** — `Mapa` + `MapaEscolas`: plota as escolas no **mapa real
  (Leaflet + OpenStreetMap)**, reutilizando o `MapaLeaflet` do Portal de
  Infraestrutura. Cada escola é um marcador com emoji por severidade (🔴 alerta
  alto · 🟠 alerta aberto · 🏫 sem alerta) e um popup com as contagens; abaixo,
  uma tabela acessível com os números. Touch-friendly (tablets/celulares).
- **Escolas** — `Escolas` (Secretaria): cadastro de escolas com coordenadas.
- **Notificações** — `Notificacoes`, feed dos alertas de nível alto para a gestão,
  com contador de não lidas no menu.
- **Gestão de usuários** — `Usuarios` (só Direção) para criar, **editar** e
  remover contas; `MinhaConta` para trocar a própria senha.
- **Eixos do aluno** — `SaudeAluno`, `AssistenciaAluno`, `VidaEscolarAluno`,
  `Logbook` e `DocumentosAluno` (abas em `AlunoDetalhe`): formulários dos eixos,
  registro de sintomas, geolocalização residencial, diário de bordo com fotos e
  o módulo de Documentos (upload por categoria, download e remoção).
- **Infraestrutura/Cidadania** — `PortalCidadao` (público/cidadão/secretaria),
  `RelatoRapido` (denúncia com 1 clique + GPS), `InfraAlertaForm` (registro com
  foto, geolocalização e anônimo; botão "usar minha localização"),
  `InfraAlertaList` (cartões) e `MapaLeaflet` (mapa interativo reutilizável, em
  modo visualização ou _picker_). No mapa, **cada categoria aparece com um
  emoji** próprio (💡 iluminação, 🕳️ buraco, 🗑️ lixo, 🚰 saneamento, 🌊
  alagamento, 📌 outro), com uma **legenda** abaixo para diferenciação rápida.
  `Cadastro` faz o autocadastro por perfil. Geolocalização do dispositivo em
  `src/geo.js` (sempre pede permissão).

A interface adapta-se ao perfil do usuário (ex.: professores não veem os botões
de cadastro/remoção de alunos; só a gestão vê "Notificações"; só a Direção vê
"Usuários").

### Notificações e e-mail

Alertas de **nível alto** (e os alertas automáticos de **surto** e **área de
risco**) geram uma notificação para a equipe de gestão, exibida no feed de
**Notificações**. Quando o **SMTP está configurado** (variáveis `SAAE_SMTP_*`),
a mesma notificação também é enviada por **e-mail** — via `nodemailer`, em
`backend/src/email.js` e `backend/src/notificador.js`.

Os destinatários **espelham o escopo do feed** e ainda incluem o **professor
responsável**: a **Secretaria** (visão municipal) sempre recebe; a **Coordenação**
e a **Direção** da escola relacionada recebem quando o alerta tem escola; e os
**professores responsáveis pela turma do aluno** recebem por e-mail (cidadãos não
recebem). O vínculo professor↔turma é definido na **Gestão de usuários** (tabela
`professor_turmas`); o professor recebe apenas o **e-mail** — o feed interno
segue restrito à gestão. O envio é **"fire-and-forget"**: uma falha de SMTP nunca
quebra a requisição nem impede o registro no feed interno. **Sem
`SAAE_SMTP_HOST`/`SAAE_SMTP_URL`, o e-mail fica desligado** e o sistema roda
apenas com o feed interno — ideal para desenvolvimento sem serviço externo.

---

## Testes

**API (backend)** — `backend/test/`, com o runner nativo `node:test` e banco
**em memória** (`SAAE_DB=:memory:`):
- `api.test.js` — autenticação, permissões por perfil, CRUD de alunos, alertas,
  histórico, relatórios, notificações e troca de senha.
- `expansao.test.js` — eixos Saúde/Assistência/Vida Escolar (incl. **surto por
  turma**, **área de risco** e **upload no diário**), infraestrutura (GET público,
  registro do cidadão, **anônimo sem vazar identidade**, status só da Secretaria),
  **autocadastro por perfil** e **bloqueio do cidadão** nas áreas de aluno.
- `email.test.js` — envio de notificações por **e-mail (SMTP)** com transporte
  falso: valida **quando** se envia (nível alto sim, médio não) e **para quem**
  (Secretaria + Coordenação/Direção do escopo + **professor responsável pela
  turma**; professor sem a turma e gestão de outra escola não recebem; endpoint
  de turmas recusa quem não é professor).

**Componentes (frontend)** — em `frontend/src/**/*.test.jsx`, com **Vitest** +
**Testing Library** (ambiente jsdom). Cobrem `Badge`, `BarChart`, `DonutChart`,
`Heatmap`, `InfraAlertaList`, `InfraAlertaForm` (mapa mockado), `Cadastro`,
`DocumentosAluno` e `RelatoRapido` (geolocalização mockada).

```powershell
npm test                 # roda backend e frontend (a partir da raiz)
npm run test:backend     # só a API
npm run test:frontend    # só os componentes
```

---

## Variáveis de ambiente

Todas são **opcionais** (há valores padrão para desenvolvimento):

| Variável       | Padrão              | Descrição                                              |
|----------------|---------------------|--------------------------------------------------------|
| `PORT`         | `3001`              | Porta do backend                                       |
| `SAAE_DB`      | `backend/data/saae.db` | Caminho do banco; use `:memory:` para banco temporário |
| `SAAE_SEGREDO` | (segredo de dev)    | Chave para assinar os tokens — **defina em produção**  |
| `SAAE_UPLOADS` | `backend/data/uploads` | Pasta das imagens enviadas (fotos de alerta e diário) |
| `SAAE_LIMITE_SINTOMAS` | `3`         | Nº de alunos da turma com sintomas semelhantes (24h) que dispara o alerta de surto |
| `SAAE_SMTP_URL` | —                  | URL completa do SMTP (ex.: `smtp://usuario:senha@host:587`). Tem precedência sobre as variáveis `SAAE_SMTP_*` abaixo |
| `SAAE_SMTP_HOST` | —                 | Servidor SMTP (alternativa à URL). **Sem host/URL, o envio por e-mail fica desligado** |
| `SAAE_SMTP_PORTA` | `587`            | Porta do SMTP |
| `SAAE_SMTP_USUARIO` / `SAAE_SMTP_SENHA` | — | Credenciais de autenticação SMTP |
| `SAAE_SMTP_SEGURO` | `false`         | `true` para TLS direto (normalmente porta 465) |
| `SAAE_EMAIL_REMETENTE` | `Itaitinga Conectada <nao-responder@itaitinga.local>` | Remetente exibido nos e-mails |

---

## Próximos passos

Ideias de evolução mantendo a simplicidade do MVP:

- ~~Envio real por e-mail das notificações~~ ✅ **feito** — SMTP via `nodemailer`
  (`backend/src/email.js`), configurável por `SAAE_SMTP_*`.
- Armazenamento de fotos em **nuvem** (ex.: S3) trocando o storage do multer em
  `backend/src/uploads.js`.
- ~~Notificações também para o próprio professor responsável~~ ✅ **feito** —
  vínculo professor↔turma (`professor_turmas`) direciona os e-mails.
- Áreas de risco como **polígonos** (hoje círculo centro+raio) e camada no mapa.
- Testes end-to-end (ex.: Playwright).
