import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // 部署到 GitHub Pages 项目页（如 https://<org>.github.io/CloudSteps/）时，
  // 通过 VITE_BASE_PATH 传入子路径；本地开发/其他部署方式默认使用根路径。
  base: process.env.VITE_BASE_PATH || '/',
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  server: {
    port: 3000,
    host: true,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:7080',
        changeOrigin: true,
        ws: true,
      },
      '/uploads': {
        target: 'http://localhost:7080',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
