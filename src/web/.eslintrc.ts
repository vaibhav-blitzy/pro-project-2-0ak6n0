module.exports = {
  // @typescript-eslint/eslint-plugin ^5.59.0
  // @typescript-eslint/parser ^5.59.0
  // eslint-plugin-react ^7.32.0
  // eslint-plugin-react-hooks ^4.6.0

  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    },
    project: './tsconfig.json'
  },

  env: {
    browser: true,
    es2022: true,
    node: true,
    jest: true
  },

  settings: {
    react: {
      version: 'detect'
    }
  },

  plugins: [
    '@typescript-eslint',
    'react',
    'react-hooks'
  ],

  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended'
  ],

  rules: {
    // TypeScript specific rules
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/strict-boolean-expressions': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
    '@typescript-eslint/restrict-template-expressions': 'error',

    // React specific rules
    'react/prop-types': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'react/jsx-no-undef': 'error',
    'react/jsx-uses-react': 'error',
    'react/jsx-uses-vars': 'error',

    // General code quality rules
    'no-console': ['warn', { 'allow': ['warn', 'error'] }],
    'eqeqeq': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    'no-duplicate-imports': 'error',
    'no-shadow': 'error',
    'no-use-before-define': 'error',
    'prefer-arrow-callback': 'error',
    'prefer-template': 'error'
  }
};