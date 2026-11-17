import { defineConfig } from 'vitest/config';
import { ENTORNO_TESTS } from './src/test/entornoTests';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Antes de todos los tests: aplica las migraciones en la base de tests.
    globalSetup: ['src/test/prepararBaseDeTests.ts'],
    // Todos los archivos comparten UNA base de tests: los corremos de a uno
    // para que un archivo no borre los datos que otro está usando.
    fileParallelism: false,
    env: ENTORNO_TESTS,
  },
});
