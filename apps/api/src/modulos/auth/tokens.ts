import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { ROLES } from '@gimnasio/compartido';
import { entorno } from '../../config/entorno';

/**
 * Usamos DOS tokens:
 *
 * 1. Token de ACCESO (JWT, dura 15 min): viaja en el header `Authorization: Bearer ...`.
 *    Está firmado, así que la API lo valida sin consultar la base: es rápido.
 *    Contra: no se puede "revocar". Por eso dura poco.
 *
 * 2. Token de REFRESCO (aleatorio, dura 30 días): vive en una cookie httpOnly que el
 *    JavaScript de la página NO puede leer (lo protege de ataques XSS). Sirve solo para
 *    pedir un token de acceso nuevo. Se guarda en la tabla `sesiones`, así que SÍ se puede
 *    revocar (cerrar sesión, desactivar un usuario, suspender un gimnasio).
 */

// ─────────────────────────── Token de acceso (JWT) ───────────────────────────

/** Lo que guardamos dentro del JWT. Es legible por cualquiera: nunca pongas datos sensibles. */
const esquemaContenidoJwt = z.object({
  sub: z.uuid(), // "subject": el id del usuario (nombre estándar de JWT)
  rol: z.enum(ROLES),
  gimnasioId: z.uuid().nullable(),
});

export type DatosAuth = {
  usuarioId: string;
  rol: (typeof ROLES)[number];
  gimnasioId: string | null;
};

export function firmarTokenAcceso(datos: DatosAuth): string {
  const contenido: z.infer<typeof esquemaContenidoJwt> = {
    sub: datos.usuarioId,
    rol: datos.rol,
    gimnasioId: datos.gimnasioId,
  };
  return jwt.sign(contenido, entorno.JWT_SECRETO, {
    algorithm: 'HS256',
    expiresIn: `${entorno.MINUTOS_TOKEN_ACCESO}m`,
  });
}

/** Devuelve los datos del token, o `null` si es inválido, está vencido o fue manipulado. */
export function verificarTokenAcceso(token: string): DatosAuth | null {
  try {
    // Fijamos el algoritmo: evita ataques donde el token dice "alg: none" para saltear la firma.
    const decodificado = jwt.verify(token, entorno.JWT_SECRETO, { algorithms: ['HS256'] });
    const contenido = esquemaContenidoJwt.parse(decodificado);
    return { usuarioId: contenido.sub, rol: contenido.rol, gimnasioId: contenido.gimnasioId };
  } catch {
    return null;
  }
}

// ─────────────────── Tokens aleatorios (refresco y activación) ───────────────────

export const NOMBRE_COOKIE_REFRESCO = 'token_refresco';

/**
 * 48 bytes aleatorios criptográficamente seguros: imposible de adivinar.
 * Se usa para los tokens de refresco y para los links de activación de los socios.
 */
export function generarTokenAleatorio(): string {
  return randomBytes(48).toString('base64url');
}

/**
 * En la base guardamos el HASH del token, nunca el token. Alcanza con SHA-256 (rápido)
 * porque el token ya es totalmente aleatorio; las contraseñas, en cambio, necesitan bcrypt
 * (lento) porque las personas eligen contraseñas fáciles de adivinar.
 */
export function hashearToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function vencimientoTokenRefresco(desde = new Date()): Date {
  return new Date(desde.getTime() + entorno.DIAS_TOKEN_REFRESCO * 24 * 60 * 60 * 1000);
}
