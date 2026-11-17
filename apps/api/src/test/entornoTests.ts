/**
 * Variables de entorno de los tests, en un solo lugar.
 * Las usan vitest.config.ts (para los tests) y el global setup (para migrar la base de tests).
 */
export const ENTORNO_TESTS = {
  NODE_ENV: 'test',
  // Base de tests de docker-compose (puerto 5434). Nunca la de desarrollo.
  DATABASE_URL: 'postgresql://gimnasio:gimnasio@localhost:5434/gimnasio_test',
  JWT_SECRETO: 'secreto-solo-para-tests-con-mas-de-32-caracteres',
} as const;
