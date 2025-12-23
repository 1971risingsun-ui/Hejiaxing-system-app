import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import process from 'node:process';

export default defineConfig(({ mode }) => {
  // Fix for line 6: Property 'cwd' does not exist on type 'Process'.
  // Using imported process ensures that cwd() is correctly typed for the build environment.
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    // 修正：針對 GitHub Pages 的子路徑設定正確的 base
    base: '/Hejiaxing-system-app/',
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  };
});
