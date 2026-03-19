import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Explicitly load .env file — required in library/IIFE mode
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    define: {
      'process.env.NODE_ENV':                   JSON.stringify('production'),
      'import.meta.env.VITE_API_URL':           JSON.stringify(env.VITE_API_URL           || 'https://mediko-chatbot-production.up.railway.app'),
      'import.meta.env.VITE_SUPABASE_URL':      JSON.stringify(env.VITE_SUPABASE_URL      || ''),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || ''),
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
