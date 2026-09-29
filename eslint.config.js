import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  // Only src/lib (the one client) and src/services (the data access layer) may talk to Supabase
  // directly — everything else goes through services (ROADMAP Phase 9).
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lib/**', 'src/services/**'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{
          name: '@supabase/supabase-js',
          message: 'Import the shared client from src/lib/supabase.ts, or go through src/services — components never call @supabase/supabase-js directly.',
        }],
      }],
    },
  },
])
