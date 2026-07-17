import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

function chunkFileName(chunkInfo: { moduleIds: string[] }) {
  const containsThreeRuntime = chunkInfo.moduleIds.some((id) => {
    const normalizedId = id.replaceAll('\\', '/');
    return normalizedId.includes('/node_modules/three/build/')
      || normalizedId.includes('/node_modules/@react-three/fiber/');
  });

  return containsThreeRuntime ? 'assets/three-runtime-[hash].js' : 'assets/[name]-[hash].js';
}

export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        chunkFileNames: chunkFileName,
      },
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
}));
