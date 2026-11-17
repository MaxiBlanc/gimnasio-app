import { execSync } from 'node:child_process';
import { ENTORNO_TESTS } from './entornoTests';

/**
 * "Global setup" de Vitest: corre UNA vez antes de todos los tests.
 * Aplica las migraciones a la base de tests para que tenga las mismas tablas que la de desarrollo.
 * `migrate deploy` solo aplica migraciones existentes: nunca crea nuevas ni borra datos.
 *
 * Ojo: el `env` de vitest.config.ts llega a los tests pero NO a este archivo,
 * por eso pasamos la URL de la base explícitamente.
 */
export default function prepararBaseDeTests() {
  try {
    execSync('npx prisma migrate deploy', {
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: ENTORNO_TESTS.DATABASE_URL },
    });
  } catch (error) {
    const salida = error as { stdout?: Buffer; stderr?: Buffer };
    throw new Error(
      '❌ No se pudo migrar la base de tests. ¿Está levantado Docker? (npm run db:levantar)\n' +
        `${salida.stdout?.toString() ?? ''}${salida.stderr?.toString() ?? ''}`,
      { cause: error }, // conserva el error original para poder investigarlo
    );
  }
}
