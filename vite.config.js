import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // 5层架构分层 alias
      '@ui': path.resolve(__dirname, 'src/ui'),
      '@state': path.resolve(__dirname, 'src/state'),
      '@services': path.resolve(__dirname, 'src/services'),
      '@repositories': path.resolve(__dirname, 'src/repositories'),
      '@core': path.resolve(__dirname, 'src/core'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      
      // 通用 alias
      '@config': path.resolve(__dirname, 'src/config'),
      '@data': path.resolve(__dirname, 'src/data'),
      '@assets': path.resolve(__dirname, 'src/assets'),
      '@hooks': path.resolve(__dirname, 'src/hooks'),
      
      // 过渡 alias：迁移完成后移除
      '@components': path.resolve(__dirname, 'src/components'),
      '@pages': path.resolve(__dirname, 'src/pages'),
      '@store': path.resolve(__dirname, 'src/store'),
    }
  },
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
