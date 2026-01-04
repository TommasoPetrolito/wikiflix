import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true, // Listen on all network interfaces - allows access from other devices
    strictPort: false, // Try next available port if 3000 is taken
    proxy: {
      '/sparql': {
        target: 'https://query.wikidata.org',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/sparql/, '/sparql'),
      },
      // Proxy Commons media to avoid CORS blocks on Special:FilePath redirects
      '/commons-media': {
        target: 'https://commons.wikimedia.org',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/commons-media/, ''),
      },
      // Proxy direct upload host for media files to bypass CORS issues in dev
      '/upload-media': {
        target: 'https://upload.wikimedia.org',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/upload-media/, ''),
      },
    },
  },
})
