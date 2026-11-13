import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Explicitly load .env file — required in library/IIFE mode
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    // Preact via its React-compatible layer: same React source code, about half
    // the bundle size on every store page. JSX still compiles to react/jsx-runtime,
    // which is aliased too.
    resolve: {
      alias: {
        'react-dom/client':    'preact/compat/client',
        'react-dom/test-utils': 'preact/test-utils',
        'react-dom':           'preact/compat',
        'react/jsx-runtime':   'preact/jsx-runtime',
        'react/jsx-dev-runtime': 'preact/jsx-dev-runtime',
        'react':               'preact/compat'
      }
    },
    define: {
      'process.env.NODE_ENV':         JSON.stringify('production'),
      'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL || 'https://mediko-chatbot-production.up.railway.app'),
    },
    build: {
      lib: {
        entry:    'src/main.jsx',
        name:     'MedikoChat',
        fileName: 'mediko-chat',
        formats:  ['iife']
      },
      rollupOptions: { external: [] },
      outDir:                  'dist',
      emptyOutDir:             true,
      cssCodeSplit:            false,
      chunkSizeWarningLimit:   600
    }
  }
})
