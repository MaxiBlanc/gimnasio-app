/**
 * Roles de los usuarios del sistema.
 *
 * `as const` hace que TypeScript trate el array como una tupla de literales
 * ('SUPERADMIN' | 'DUENO' | ...) en vez de un string[] cualquiera. Así podemos derivar
 * el tipo `Rol` desde el valor y la lista vive en un solo lugar.
 *
 * Los socios no son "usuarios": tienen su propia tabla y su propio login (DNI + contraseña).
 */
export const ROLES = ['SUPERADMIN', 'DUENO', 'RECEPCION', 'PROFESOR', 'KIOSCO'] as const;

export type Rol = (typeof ROLES)[number];

/**
 * Quién puede tener una sesión: el personal (con su rol) o un SOCIO.
 * Los socios no están en `ROLES` porque no son usuarios del panel, pero sí inician sesión
 * (desde el celular) y su token de acceso lleva `rol: 'SOCIO'`.
 */
export const ROLES_SESION = [...ROLES, 'SOCIO'] as const;
export type RolSesion = (typeof ROLES_SESION)[number];

/** Texto para mostrar cada rol en pantalla. `Record<...>` obliga a no olvidar ninguno. */
export const NOMBRES_ROL: Record<RolSesion, string> = {
  SUPERADMIN: 'Súper-admin',
  DUENO: 'Dueño',
  RECEPCION: 'Recepción',
  PROFESOR: 'Profesor',
  KIOSCO: 'Pantalla de ingreso',
  SOCIO: 'Socio',
};
