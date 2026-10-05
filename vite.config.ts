import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 로컬 개발: 쿠키가 같은 출처로 오가도록 /api 를 백엔드로 넘긴다(운영은 Nginx 가 같은 일을 한다)
    proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') } },
  },
})
