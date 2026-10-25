// Linter del monorepo: backend (TypeScript/Node) y client (React/Vite).
// El formato lo resuelve Prettier; eslint-config-prettier apaga las reglas
// de estilo que chocarían con él.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  // frontend/ es el cliente HTML anterior, ya reemplazado por client/.
  { ignores: ['**/dist/**', '**/node_modules/**', 'frontend/**', 'backend/prisma/migrations/**'] },

  js.configs.recommended,
  // `_algo` marca un parámetro obligatorio que no se usa (ej. el `next` de
  // un error handler de Express); `{ descartado, ...resto }` es válido.
  { rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }] } },

  {
    files: ['backend/**/*.ts'],
    extends: [tseslint.configs.recommended],
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },
  {
    // Los tests reemplazan modelos de Prisma por objetos en memoria.
    files: ['backend/**/*.test.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },

  {
    files: ['client/**/*.{js,jsx}'],
    languageOptions: { globals: globals.browser, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Sin eslint-plugin-react, los componentes usados solo en JSX se
      // verían como "sin usar": se ignoran los nombres en PascalCase.
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },

  {
    files: ['scripts/**/*.mjs', '*.config.{js,mjs}', 'client/*.config.js', 'client/cypress/**/*.js'],
    // Cypress expone cy, Cypress y expect (Chai) como globales.
    languageOptions: {
      globals: { ...globals.node, ...globals.mocha, cy: 'readonly', Cypress: 'readonly', expect: 'readonly' },
    },
  },

  prettier,
);
