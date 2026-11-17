import { Prisma } from './generated/prisma/client';

/**
 * Ayudas para reconocer errores que vienen de Postgres.
 *
 * Prisma envuelve los errores de la base; el código ORIGINAL de Postgres (ej. "23P01")
 * queda adentro, en `meta.driverAdapterError.cause.originalCode`. Usamos ese código
 * porque es estándar de Postgres y no cambia entre versiones de Prisma.
 * Lista de códigos: https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
function codigoPostgres(error: unknown): string | undefined {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return undefined;
  const meta = error.meta as
    { driverAdapterError?: { cause?: { originalCode?: string } } } | undefined;
  return meta?.driverAdapterError?.cause?.originalCode;
}

/** 23505: se violó una restricción UNIQUE (dato duplicado). */
export function esViolacionDeUnicidad(error: unknown): boolean {
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') ||
    codigoPostgres(error) === '23505'
  );
}

/** 23P01: se violó una restricción EXCLUDE (ej. dos pagos vigentes para el mismo mes). */
export function esViolacionDeExclusion(error: unknown): boolean {
  return codigoPostgres(error) === '23P01';
}
