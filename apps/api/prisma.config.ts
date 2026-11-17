import { defineConfig } from 'prisma/config';

// La CLI de Prisma no lee el .env sola. Usamos la función nativa de Node para cargarlo.
// En producción (Vercel) no hay archivo .env: las variables ya vienen del entorno.
try {
  process.loadEnvFile('../../.env');
} catch {
  // Sin archivo .env: seguimos con las variables del entorno.
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env['DATABASE_URL'] ?? '',
  },
});
