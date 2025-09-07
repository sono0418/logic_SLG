// backend/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // 親ディレクトリ（プロジェクトのルート）にあるfrontend/index.htmlを指す
      input: path.resolve(__dirname, '..', 'frontend', 'index.html'),
    },
  },
});