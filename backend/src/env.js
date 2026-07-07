// Carrega variáveis de um arquivo `.env` (na raiz do backend), se existir.
// Parser mínimo, sem dependências — evita depender de flags do Node que variam
// entre versões (--env-file). NÃO sobrescreve variáveis já definidas no
// ambiente, e é ignorado nos testes (que usam banco em memória) para não
// disparar envios reais de e-mail durante a suíte.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Nos testes (SAAE_DB=':memory:') não carregamos o .env.
if (process.env.SAAE_DB !== ':memory:') {
  const aqui = dirname(fileURLToPath(import.meta.url));
  const caminho = join(aqui, '..', '.env'); // backend/.env

  if (existsSync(caminho)) {
    for (const linha of readFileSync(caminho, 'utf8').split(/\r?\n/)) {
      const t = linha.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i === -1) continue;
      const chave = t.slice(0, i).trim();
      let valor = t.slice(i + 1).trim();
      if (
        (valor.startsWith('"') && valor.endsWith('"')) ||
        (valor.startsWith("'") && valor.endsWith("'"))
      ) {
        valor = valor.slice(1, -1);
      }
      if (chave && process.env[chave] === undefined) process.env[chave] = valor;
    }
  }
}
