import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';
import { entorno } from './config/entorno';

/**
 * Única instancia del cliente de Prisma para toda la API.
 * Desde Prisma 7 la conexión la hace un "driver adapter": acá usamos el driver `pg`,
 * el cliente de Postgres estándar de Node. Prisma arma el SQL y `pg` lo manda a la base.
 */
export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: entorno.DATABASE_URL }),
});
