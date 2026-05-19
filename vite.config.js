import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173
  },
  build: {
    rollupOptions: {
      // 注意：不要把Capacitor插件设为external！
      // 它们的JavaScript部分必须被打包进bundle
      // 原生部分由Capacitor CLI在构建APK时处理
    }
  }
})
