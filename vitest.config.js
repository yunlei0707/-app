import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@ui': path.resolve(__dirname, 'src/ui'),
      '@state': path.resolve(__dirname, 'src/state'),
      '@services': path.resolve(__dirname, 'src/services'),
      '@repositories': path.resolve(__dirname, 'src/repositories'),
      '@core': path.resolve(__dirname, 'src/core'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@config': path.resolve(__dirname, 'src/config'),
      '@data': path.resolve(__dirname, 'src/data'),
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.js', 'tests/**/*.test.jsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    }
  }
});
