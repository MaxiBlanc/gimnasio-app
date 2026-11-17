// Configuración de ESLint ("flat config") para todo el monorepo.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/generated/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      // Permite variables sin usar si empiezan con "_" (ej. parámetros obligatorios de Express).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Obliga a usar "import type" para tipos: deja claro qué se borra al compilar.
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  // La web corre en el navegador y usa React: reglas de hooks (orden de llamada, dependencias).
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    ...reactHooks.configs.flat.recommended,
  },
  // Va al final: desactiva las reglas de estilo que Prettier ya maneja.
  prettier,
);
