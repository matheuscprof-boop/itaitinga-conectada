// Armazenamento local de imagens (fotos de alerta e do diário de bordo).
// Para o MVP gravamos em disco sob backend/data/uploads e servimos como
// arquivos estáticos. Caminho de migração para nuvem: basta trocar o
// `storage` do multer por um adaptador (ex.: multer-s3) e ajustar a URL.

import multer from 'multer';
import crypto from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Diretório configurável (útil para os testes usarem uma pasta temporária).
export const UPLOADS_DIR =
  process.env.SAAE_UPLOADS || join(__dirname, '..', 'data', 'uploads');
mkdirSync(UPLOADS_DIR, { recursive: true });

// Extensões conhecidas — usadas para preservar o sufixo do arquivo salvo.
const EXTENSOES_IMAGEM = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const EXTENSOES_DOC = new Set([
  ...EXTENSOES_IMAGEM,
  '.pdf', '.doc', '.docx', '.odt', '.txt',
]);

function criarStorage(extensoesOk, extPadrao) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      let ext = extname(file.originalname || '').toLowerCase();
      if (!extensoesOk.has(ext)) ext = extPadrao;
      cb(null, `${crypto.randomBytes(10).toString('hex')}${ext}`);
    },
  });
}

const uploadImagem = multer({
  storage: criarStorage(EXTENSOES_IMAGEM, '.jpg'),
  fileFilter: (_req, file, cb) => cb(null, /^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype || '')),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

const TIPOS_DOC = /^(image\/(png|jpe?g|webp|gif)|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|application\/vnd\.oasis\.opendocument\.text|text\/plain)$/;
const uploadDocumentoMulter = multer({
  storage: criarStorage(EXTENSOES_DOC, '.bin'),
  fileFilter: (_req, file, cb) => cb(null, TIPOS_DOC.test(file.mimetype || '')),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// Envolve o multer e traduz erros (tamanho/tipo) para 400.
function comUpload(middleware, msgTamanho) {
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (err) {
        const msg = err.code === 'LIMIT_FILE_SIZE' ? msgTamanho : 'Não foi possível processar o arquivo enviado.';
        return res.status(400).json({ erro: msg });
      }
      next();
    });
  };
}

// Middleware: imagem única no campo "foto".
export const uploadFoto = comUpload(uploadImagem.single('foto'), 'A imagem excede o limite de 5 MB.');

// Middleware: documento único no campo "arquivo" (PDF/imagem/office).
export const uploadDocumento = comUpload(uploadDocumentoMulter.single('arquivo'), 'O documento excede o limite de 10 MB.');

// Caminho público (relativo) que fica salvo no banco e é servido por /uploads.
export function caminhoPublico(file) {
  return file ? `/uploads/${file.filename}` : null;
}
