import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 45445,
    proxy: {
      '/ws': {
        target: 'ws://localhost:46446',
        ws: true,
      },
    },
  },
})
