import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    // Inject API URL at build time — override with VITE_API_URL env var
    'import.meta.env.VITE_API_URL': JSON.stringify(
      process.env.VITE_API_URL || 'http://localhost:3001'
    )
  },
  build: {
    // Single IIFE file — no code splitting, no dynamic imports
    lib: {
      entry:    'src/main.jsx',
      name:     'MedikoChat',
      fileName: 'mediko-chat',
      formats:  ['iife']
    },
    rollupOptions: {
      // Bundle React inside the IIFE — Shopify themes don't have React globally
      external: [],
      output: {
        // Inline all CSS into the JS bundle via injectedStyles in main.jsx
        assetFileNames: '[name][extname]'
      }
    },
    // Single output file in dist/
    outDir:       'dist',
    emptyOutDir:  true,
    // Inline CSS as a JS string so we have one file to deploy
    cssCodeSplit: false
  }
})
