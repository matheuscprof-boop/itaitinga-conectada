// Envio de e-mail por SMTP (via nodemailer).
//
// É OPCIONAL: se não houver configuração de SMTP no ambiente, o módulo fica
// inerte (no-op) e o sistema continua funcionando apenas com o feed interno de
// notificações — mantendo o MVP rodável sem nenhum serviço externo.
//
// Configuração por variáveis de ambiente (todas opcionais):
//   SAAE_SMTP_URL         URL completa (ex.: smtp://usuario:senha@host:587).
//                         Se definida, tem precedência sobre as variáveis abaixo.
//   SAAE_SMTP_HOST        servidor SMTP
//   SAAE_SMTP_PORTA       porta (padrão 587)
//   SAAE_SMTP_USUARIO     usuário de autenticação
//   SAAE_SMTP_SENHA       senha de autenticação
//   SAAE_SMTP_SEGURO      'true' para TLS direto (normalmente porta 465)
//   SAAE_EMAIL_REMETENTE  remetente exibido (padrão abaixo)

import nodemailer from 'nodemailer';

const REMETENTE_PADRAO = 'Itaitinga Conectada <nao-responder@itaitinga.local>';

// Transporte injetado nos testes — quando presente, dispensa SMTP real.
let transporteTeste = null;
// Cache do transporte real (criado sob demanda a partir do ambiente).
let transporteReal = null;

// Monta a configuração do transporte a partir do ambiente, ou null se não houver.
function configDoAmbiente() {
  if (process.env.SAAE_SMTP_URL) return process.env.SAAE_SMTP_URL;
  if (process.env.SAAE_SMTP_HOST) {
    return {
      host: process.env.SAAE_SMTP_HOST,
      port: Number(process.env.SAAE_SMTP_PORTA) || 587,
      secure: process.env.SAAE_SMTP_SEGURO === 'true',
      auth: process.env.SAAE_SMTP_USUARIO
        ? { user: process.env.SAAE_SMTP_USUARIO, pass: process.env.SAAE_SMTP_SENHA || '' }
        : undefined,
    };
  }
  return null;
}

// O envio por e-mail está habilitado? (transporte de teste OU SMTP no ambiente)
export function emailConfigurado() {
  return Boolean(transporteTeste) || Boolean(configDoAmbiente());
}

export function remetente() {
  return process.env.SAAE_EMAIL_REMETENTE || REMETENTE_PADRAO;
}

// Retorna o transporte a usar (teste > real em cache > cria a partir do env).
function obterTransporte() {
  if (transporteTeste) return transporteTeste;
  if (transporteReal) return transporteReal;
  const cfg = configDoAmbiente();
  if (!cfg) return null;
  transporteReal = nodemailer.createTransport(cfg);
  return transporteReal;
}

// Envia um e-mail. Retorna o `info` do envio (ou null se não há transporte /
// destinatário). Pode lançar em falha de rede/SMTP — o chamador decide se trata
// como fatal (nas notificações o envio é sempre "fire-and-forget").
export async function enviarEmail({ para, assunto, texto, html }) {
  const transporte = obterTransporte();
  if (!transporte) return null; // sem configuração → não envia
  const destinatarios = Array.isArray(para) ? para.filter(Boolean).join(', ') : para;
  if (!destinatarios) return null;

  return transporte.sendMail({
    from: remetente(),
    to: destinatarios,
    subject: assunto,
    text: texto,
    ...(html ? { html } : {}),
  });
}

// --- Suporte a testes: injeta/reseta um transporte falso (com `sendMail`). ---
export function configurarTransporteParaTeste(transporte) {
  transporteTeste = transporte;
}

export function resetTransporteParaTeste() {
  transporteTeste = null;
  transporteReal = null;
}
