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
  // Neon y otros proveedores a veces la dan como postgres:// (es lo mismo).
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'Debe ser una URL de PostgreSQL'),
  // Clave con la que se firman los JWT. Si alguien la conoce, puede fabricar tokens válidos.
  JWT_SECRETO: z.string().min(32, 'Debe tener al menos 32 caracteres'),
  MINUTOS_TOKEN_ACCESO: z.coerce.number().int().positive().default(15),
  DIAS_TOKEN_REFRESCO: z.coerce.number().int().positive().default(30),

  // Correo. "smtp" manda de verdad (Mailpit en desarrollo, Resend en producción);
  // "memoria" no manda nada y guarda los mails en un array (para los tests).
  CORREO_MODO: z.enum(['smtp', 'memoria']).default('smtp'),
  CORREO_REMITENTE: z.string().default('GimnasioApp <no-responder@gimnasioapp.local>'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PUERTO: z.coerce.number().int().positive().default(1025),
  SMTP_USUARIO: z.string().optional(),
  SMTP_CONTRASENA: z.string().optional(),
  DIAS_VALIDEZ_ACTIVACION: z.coerce.number().int().positive().default(7),

  // Secreto que Vercel manda al llamar al cron (mails automáticos). Sin él, el cron no corre.
  CRON_SECRET: z.string().min(16).optional(),
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
