// Ponto de entrada da API do Itaitinga Conectada.
// Sobe um servidor Express com autenticação, alunos, alertas, relatórios,
// os eixos de dados do aluno (Saúde/Assistência/Vida Escolar) e o eixo de
// Infraestrutura/Cidadania.

import './env.js'; // carrega backend/.env (SMTP etc.) antes de tudo

import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';

import './db.js'; // garante a criação do banco/esquema no arranque
import db from './db.js';
import { garantirAdminPadrao } from './bootstrap.js';
import { autenticar, exigirPerfil, bloquearPerfil } from './auth.js';
import { UPLOADS_DIR } from './uploads.js';
import authRouter from './routes/auth.js';
import escolasRouter from './routes/escolas.js';
import alunosRouter from './routes/alunos.js';
import alertasRouter from './routes/alertas.js';
import relatoriosRouter from './routes/relatorios.js';
import notificacoesRouter from './routes/notificacoes.js';
import saudeRouter from './routes/saude.js';
import assistenciaRouter from './routes/assistencia.js';
import vidaEscolarRouter from './routes/vidaEscolar.js';
import documentosRouter from './routes/documentos.js';
import infraRouter from './routes/infra.js';
import geoRouter from './routes/geo.js';
import {
  EIXOS_LABEL, PERFIS_LABEL, NIVEIS, STATUS, PERFIS_GESTAO,
  CATEGORIAS_INFRA_LABEL, STATUS_INFRA, VACINACAO_STATUS, PERFIL_CIDADAO,
  CATEGORIAS_DOCUMENTO_LABEL,
} from './constants.js';

garantirAdminPadrao(); // cria o admin padrão se não houver usuários

const app = express();

app.use(cors());          // libera o acesso do frontend (Vite) em dev
app.use(express.json());  // interpreta corpos JSON

// Arquivos enviados (fotos de alerta e do diário de bordo) — servidos como
// estáticos. Público, adequado ao MVP.
app.use('/uploads', express.static(UPLOADS_DIR));

// Bloqueia o cidadão nas áreas de dados de aluno.
const semCidadao = bloquearPerfil(PERFIL_CIDADAO);

// --- Rotas públicas ---
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, servico: 'Itaitinga Conectada API' });
});

app.get('/api/referencias', (_req, res) => {
  res.json({
    eixos: EIXOS_LABEL,
    perfis: PERFIS_LABEL,
    niveis: NIVEIS,
    status: STATUS,
    categorias_infra: CATEGORIAS_INFRA_LABEL,
    status_infra: STATUS_INFRA,
    vacinacao_status: VACINACAO_STATUS,
    categorias_documento: CATEGORIAS_DOCUMENTO_LABEL,
  });
});

// Lista pública mínima de escolas (id + nome) para a tela de autocadastro.
const escolasPublicas = db.prepare('SELECT id, nome FROM escolas ORDER BY nome COLLATE NOCASE');
app.get('/api/escolas-publicas', (_req, res) => res.json(escolasPublicas.all()));

app.use('/api/auth', authRouter); // login/registro públicos; gestão é protegida internamente
app.use('/api/infra', infraRouter); // GET público; POST/PATCH protegidos internamente

// --- Rotas protegidas (exigem token válido; cidadão sem acesso a alunos) ---
app.use('/api/escolas', autenticar, semCidadao, escolasRouter);
app.use('/api/alunos', autenticar, semCidadao, alunosRouter);
app.use('/api/alertas', autenticar, semCidadao, alertasRouter);
app.use('/api/relatorios', autenticar, semCidadao, relatoriosRouter);
app.use('/api/saude', autenticar, semCidadao, saudeRouter);
app.use('/api/assistencia', autenticar, semCidadao, assistenciaRouter);
app.use('/api/vida-escolar', autenticar, semCidadao, vidaEscolarRouter);
app.use('/api/documentos', autenticar, semCidadao, documentosRouter);
app.use('/api/geo', autenticar, semCidadao, geoRouter); // geocodificação (endereço → lat/long)
// Notificações são exclusivas da equipe de gestão (coordenação/direção/secretaria).
app.use('/api/notificacoes', autenticar, exigirPerfil(...PERFIS_GESTAO), notificacoesRouter);

// Rota não encontrada.
app.use((_req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

// Tratador central de erros — evita vazar stack trace ao cliente.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ erro: 'Erro interno no servidor.' });
});

// Só inicia o servidor quando executado diretamente (não durante os testes,
// que importam o `app` e sobem sua própria porta efêmera).
const executadoDireto = process.argv[1] === fileURLToPath(import.meta.url);
if (executadoDireto) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Itaitinga Conectada API rodando em http://localhost:${PORT}`);
  });
}

export default app;
