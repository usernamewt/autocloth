import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'

export default defineConfig({
  plugins: [vue()],
  define: {
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_OPTIONS_API__: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'vue': path.resolve(__dirname, 'node_modules/vue/dist/vue.esm-bundler.js'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
