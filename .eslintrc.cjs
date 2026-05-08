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

    // Tracked separately by MOP-0006 (Generated Supabase Types & API Typing).
    // Until that lands, the data layer uses `any` for snake/camel mapping and
    // RPC response shapes. Re-enable as `warn` once MOP-0006 is in flight.
    '@typescript-eslint/no-explicit-any': 'off',

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
      },
    },
  ],
};
