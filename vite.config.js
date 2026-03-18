import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV':       JSON.stringify('production'),
    'import.meta.env.VITE_API_URL': JSON.stringify(
      process.env.VITE_API_URL || 'https://mediko-chatbot-production.up.railway.app'
    )
  },
  build: {
    lib: {
      entry:    'src/main.jsx',
      name:     'MedikoChat',
      fileName: 'mediko-chat',
      formats:  ['iife']
    },
    rollupOptions: {
      external: [],
      output: {
        // CSS is handled as a JS string in styles.js — no separate asset needed
        assetFileNames: '[name][extname]'
      }
    },
    outDir:                  'dist',
    emptyOutDir:             true,
    cssCodeSplit:            false,
    chunkSizeWarningLimit:   600
  }
})
