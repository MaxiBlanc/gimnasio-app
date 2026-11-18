import { z } from 'zod';
import type { RolSesion } from './roles';
import { esquemaDni } from './socios';

/**
 * Esquemas de validación del login. Los usa la API para validar lo que llega,
 * y los va a usar la web para validar el formulario ANTES de mandarlo.
 * `z.infer` saca el tipo TypeScript del esquema: no escribimos la forma dos veces.
 */

// Primero normaliza (saca espacios y pasa a minúsculas) y DESPUÉS valida el formato.
// Al revés, " Juan@Mail.com " fallaría por los espacios.
const email = z.string().trim().toLowerCase().pipe(z.email('Email inválido'));
const contrasena = z.string().min(1, 'Ingresá la contraseña');

/** Login del personal de un gimnasio (dueño, recepción, profe, pantalla de ingreso). */
export const esquemaLoginStaff = z.object({
  gimnasio: z.string().min(1, 'Falta el gimnasio'), // slug, ej. "power-gym"
  email,
  contrasena,
});
export type DatosLoginStaff = z.infer<typeof esquemaLoginStaff>;

/** Login del súper-admin (no pertenece a ningún gimnasio). */
export const esquemaLoginAdmin = z.object({ email, contrasena });
export type DatosLoginAdmin = z.infer<typeof esquemaLoginAdmin>;

/** Login del socio: con su DNI (no con el email) y la contraseña que eligió al activar la cuenta. */
export const esquemaLoginSocio = z.object({
  gimnasio: z.string().min(1, 'Falta el gimnasio'),
  dni: esquemaDni,
  contrasena,
});
export type DatosLoginSocio = z.infer<typeof esquemaLoginSocio>;

/** Datos del gimnasio que la web necesita para mostrarse con su marca. */
export interface GimnasioSesion {
  id: string;
  nombre: string;
  slug: string;
  logoUrl: string | null;
  colorPrimario: string;
  colorSecundario: string;
}

/** Usuario logueado, tal como lo devuelve la API. Nunca incluye el hash de la contraseña. */
export interface UsuarioSesion {
  id: string;
  nombre: string;
  email: string;
  rol: RolSesion; // 'SOCIO' si es un socio
  gimnasio: GimnasioSesion | null; // null solo para el súper-admin
}

/** Respuesta de login y de refresco de sesión. */
export interface RespuestaSesion {
  tokenAcceso: string;
  usuario: UsuarioSesion;
}
