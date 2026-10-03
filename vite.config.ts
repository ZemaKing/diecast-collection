import {fileURLToPath} from 'node:url'
import {defineConfig} from 'vitest/config'
import react from '@vitejs/plugin-react'

// Third-party code in its own long-cached chunks (Phase 33), so a deploy that only changes the app
// doesn't make returning visitors download React and Supabase again.
function vendorChunk(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined
  if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|cookie|set-cookie-parser)[\\/]/.test(id)) return 'react'
  if (/[\\/]node_modules[\\/](@supabase|iceberg-js|tslib)[\\/]/.test(id)) return 'supabase'
  if (/[\\/]node_modules[\\/]@tanstack[\\/]/.test(id)) return 'query'
  return undefined
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // supabase-js always builds a Realtime client; the app never uses it (Phase 33 — see
      // src/lib/realtime-stub.ts, and its test guarding the stub against supabase-js upgrades).
      '@supabase/realtime-js': fileURLToPath(new URL('./src/lib/realtime-stub.ts', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {manualChunks: vendorChunk},
    },
  },
  test: {
    environment: 'jsdom',
    // Needed so `?raw` CSS imports return real content (token guard tests in src/styles).
    css: true,
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
  },
})
