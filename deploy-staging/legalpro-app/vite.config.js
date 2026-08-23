import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'motion': ['framer-motion'],
          'charts': ['recharts'],
        },
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      // Expedientes y documentos ? .NET (C# backend)
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
      // Auth, organizaciones, gemini ? Node.js backend
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    }
  }
})
