import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true
  },
  build: {
    rollupOptions: {
      output: {
        // pdf.js's worker ships as .mjs; the iPhone app serves files by
        // extension and a module script must arrive as JavaScript, so give
        // it a plain .js name.
        assetFileNames: (info) =>
          (info.names?.[0] || info.name || '').endsWith('.mjs') ? 'assets/[name]-[hash].js' : 'assets/[name]-[hash][extname]'
      }
    }
  }
})
