import { z } from 'zod';
import { esquemaContrasenaNueva } from './gimnasios';
import type { Rol } from './roles';

/**
 * Roles que el dueño puede dar. El dueño lo crea el súper-admin (con el gimnasio) y el
 * súper-admin no es de ningún gimnasio, así que ninguno de los dos se elige acá.
 */
export const ROLES_PERSONAL = ['RECEPCION', 'PROFESOR', 'KIOSCO'] as const;
export type RolPersonal = (typeof ROLES_PERSONAL)[number];

/**
 * Recepción y profe se pueden combinar (alguien que atiende el mostrador y también da
 * clases). La pantalla de ingreso no: es una cuenta para una tablet, no para una persona,
 * y si sumara otro rol cualquiera que pase por la entrada tendría ese acceso.
 */
const esquemaRoles = z
  .array(z.enum(ROLES_PERSONAL))
  .min(1, 'Elegí al menos un rol')
  .transform((roles) => [...new Set(roles)])
  .refine((roles) => !roles.includes('KIOSCO') || roles.length === 1, {
    message: 'La pantalla de ingreso no se combina con otros roles',
  });

const email = z.string().trim().toLowerCase().pipe(z.email('Email inválido'));
const nombre = z.string().trim().min(2, 'Ingresá el nombre').max(80);

export const esquemaCrearPersonal = z.object({
  nombre,
  email,
  roles: esquemaRoles,
  contrasena: esquemaContrasenaNueva,
});
export type DatosCrearPersonal = z.infer<typeof esquemaCrearPersonal>;

/** Al editar, la contraseña es opcional: vacía = no se cambia. */
export const esquemaEditarPersonal = z.object({
  nombre,
  email,
  roles: esquemaRoles,
  activo: z.boolean(),
  contrasena: z.union([z.literal(''), esquemaContrasenaNueva]).optional(),
});
export type DatosEditarPersonal = z.infer<typeof esquemaEditarPersonal>;

export interface Personal {
  id: string;
  nombre: string;
  email: string;
  roles: Rol[];
  activo: boolean;
  /** El dueño aparece en la lista, pero no se edita desde acá. */
  editable: boolean;
}
