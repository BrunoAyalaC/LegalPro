import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Code splitting para reducir el bundle inicial de 950KB
    rollupOptions: {
      output: {
        manualChunks: {
          // Dependencias React core
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Animaciones (framer-motion es grande)
          'motion': ['framer-motion'],
          // PDF y worker (pdfjs-dist si existe)
          'supabase': ['@supabase/supabase-js'],
        },
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      // Expedientes y documentos → .NET (C# backend)
      '/api/expedientes': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
      '/api/documentos': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
      // Auth, organizaciones, gemini → Node.js backend
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    }
  }
})
