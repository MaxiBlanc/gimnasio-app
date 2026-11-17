import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Los tests usan SIEMPRE la base de tests (docker-compose, puerto 5434), nunca la de desarrollo.
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://gimnasio:gimnasio@localhost:5434/gimnasio_test',
    },
  },
});
