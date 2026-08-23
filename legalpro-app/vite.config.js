import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import viteCompression from 'vite-plugin-compression'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 10240,
      deleteOriginFile: false,
    }),
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 10240,
      deleteOriginFile: false,
    }),
  ],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 300,
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
      // Auth, organizaciones, ai -> Node.js backend
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    }
  }
})
