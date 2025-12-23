
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 這裡必須對應您的 GitHub 儲存庫名稱
  // 如果您的網址是 https://username.github.io/hejiaxing-ai/
  // 那麼 base 就要設為 '/hejiaxing-ai/'
  base: '/hejiaxing-ai/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
});
