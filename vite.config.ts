/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
      '@/components': '/src/components',
      '@/stores': '/src/stores',
      '@/services': '/src/services',
      '@/hooks': '/src/hooks',
      '@/utils': '/src/utils',
      '@/types': '/src/types'
    }
  },
  server: {
    port: 5173,
    host: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  test: {
    globals: true,
    environment: 'jsdom',
    css: false,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'supabase/functions/**',
    ],
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: ['src/integration/**'],
          setupFiles: ['./src/test/setup.ts'],
          environment: 'jsdom',
          env: {
            VITE_SUPABASE_URL: 'http://localhost:54321',
            VITE_SUPABASE_ANON_KEY: 'test-anon-key',
          },
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['src/integration/**/*.test.ts'],
          setupFiles: ['./src/integration/setup.ts'],
          environment: 'node',
          testTimeout: 60_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'src/test/',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.config.{ts,js}',
        'src/main.tsx',
        'src/vite-env.d.ts'
      ]
    }
  }
})
