import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Em desenvolvimento, encaminha as chamadas /api para o backend Express
// (porta 3001), evitando problemas de CORS e mantendo URLs relativas.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // escuta em 0.0.0.0 → permite abrir pelo IP da rede (celular/tablet)
    // Aceita o Host de túneis de desenvolvimento (ex.: cloudflared/ngrok) para
    // testar HTTPS no celular (necessário para o GPS do navegador).
    allowedHosts: true,
    proxy: {
      '/api': 'http://localhost:3001',
      '/uploads': 'http://localhost:3001',
    },
  },
});
