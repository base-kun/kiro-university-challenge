// Minimal ESLint config (ESLint 8, classic config) so `npm run lint` runs.
// Intentionally lightweight: syntactic TypeScript linting without type-aware
// rules, to keep lint fast and dependency-light for this MVP.
module.exports = {
  root: true,
  env: {
    node: true,
    browser: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    // Allow intentionally-unused args/vars when prefixed with underscore.
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    // `any` is avoided in the codebase but not worth failing lint over here.
    '@typescript-eslint/no-explicit-any': 'off',
  },
  ignorePatterns: ['dist/', 'node_modules/', 'coverage/'],
};
