module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: [
    'dist',
    'build',
    'coverage',
    'node_modules',
    '.eslintrc.cjs',
    'supabase/functions/**',
    '*.config.{ts,js}',
    'vite.config.ts',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['react-refresh'],
  rules: {
    // React Fast Refresh: shared hooks/constants live in their own files so
    // component-only modules stay HMR-friendly.
    'react-refresh/only-export-components': 'warn',

    // MOP-0006 Phase 3 (2026-06-03): rule enabled as `warn` — the data layer
    // has been substantially typed (client + 35 supabase casts removed), but
    // ~250 `any` usages remain in components/hooks/stores that need per-call-
    // site cleanup. Warnings are tracked; address incrementally. Promote to
    // `error` once the warning count is in the low double digits.
    '@typescript-eslint/no-explicit-any': 'warn',

    // Allow `_`-prefixed unused vars (common pattern for intentionally ignored args)
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],

    // `let foo = ...` that is never reassigned should be `const`, but this is
    // pure style and not worth churning the codebase over right now.
    'prefer-const': 'warn',

    // `@ts-ignore` is sometimes the right escape hatch; warn rather than error.
    '@typescript-eslint/ban-ts-comment': 'warn',
  },
  overrides: [
    {
      // Test files: relax a few rules
      files: ['**/*.test.ts', '**/*.test.tsx', 'src/test/**/*'],
      rules: {
        '@typescript-eslint/no-non-null-assertion': 'off',
        // Test fixtures and mock payloads use `any` heavily — that's not
        // the structural debt MOP-0006 is targeting. Keep this off for tests.
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
};
