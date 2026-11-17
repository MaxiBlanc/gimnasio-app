import { z } from 'zod';

/**
 * Validamos las variables de entorno UNA vez, al arrancar.
 * Si falta algo o tiene un formato inválido, la app no arranca y nos dice qué está mal,
 * en vez de fallar más tarde con un error confuso.
 * Además, `entorno` queda tipado: entorno.PUERTO es un number, no un string | undefined.
 */
const esquemaEntorno = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PUERTO: z.coerce.number().int().positive().default(3000),
  ORIGEN_WEB: z.url().default('http://localhost:5173'),
  DATABASE_URL: z.string().startsWith('postgresql://', 'Debe ser una URL de PostgreSQL'),
});

export type Entorno = z.infer<typeof esquemaEntorno>;

function cargarEntorno(): Entorno {
  const resultado = esquemaEntorno.safeParse(process.env);
  if (!resultado.success) {
    console.error('❌ Variables de entorno inválidas:', z.treeifyError(resultado.error));
    throw new Error('Variables de entorno inválidas');
  }
  return resultado.data;
}

export const entorno = cargarEntorno();
