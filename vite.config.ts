import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1520, strictPort: true, watch: { ignored: ['**/src-tauri/**', '**/tools/**'] } },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
});
