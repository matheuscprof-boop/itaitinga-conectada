import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Configuração dos testes de componentes (separada do vite.config.js do app).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',      // DOM simulado para renderizar componentes
    globals: true,             // describe/it/expect sem importar
    setupFiles: './src/test/setup.js',
    include: ['src/**/*.test.{js,jsx}'],
  },
});
