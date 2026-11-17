import { z } from 'zod';
import type { Rol } from './roles';

/** Reglas reutilizables. Las mismas reglas que la base de datos, pero con mensajes en castellano. */
export const esquemaSlug = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Mínimo 3 caracteres')
  .max(40, 'Máximo 40 caracteres')
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Solo letras minúsculas, números y guiones (ej. power-gym)');

export const esquemaColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Color inválido: usá el formato #RRGGBB')
  .transform((color) => color.toUpperCase());

/** Contraseña nueva: mínimo razonable sin volver loco al usuario. */
export const esquemaContrasenaNueva = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(72, 'Máximo 72 caracteres'); // bcrypt ignora lo que pase de 72 bytes

/** Datos editables de un gimnasio por el súper-admin. El slug NO se edita: rompería las URLs. */
const camposGimnasio = {
  nombre: z.string().trim().min(2, 'Mínimo 2 caracteres').max(80),
  // Logo por URL (no subimos archivos, para mantener el costo en cero). Solo https.
  logoUrl: z
    .url({ protocol: /^https$/, message: 'Debe ser una URL https' })
    .nullable()
    .optional(),
  colorPrimario: esquemaColor.optional(),
  colorSecundario: esquemaColor.optional(),
};

/** Alta de un gimnasio junto con su usuario dueño. */
export const esquemaCrearGimnasio = z.object({
  gimnasio: z.object({ ...camposGimnasio, slug: esquemaSlug }),
  dueno: z.object({
    nombre: z.string().trim().min(2, 'Mínimo 2 caracteres').max(80),
    email: z.string().trim().toLowerCase().pipe(z.email('Email inválido')),
    contrasena: esquemaContrasenaNueva,
  }),
});
export type DatosCrearGimnasio = z.infer<typeof esquemaCrearGimnasio>;

/** Edición parcial (PATCH): todos los campos opcionales, más la posibilidad de suspender. */
export const esquemaEditarGimnasio = z
  .object({ ...camposGimnasio, activo: z.boolean() })
  .partial()
  .refine((datos) => Object.keys(datos).length > 0, 'No hay nada para modificar');
export type DatosEditarGimnasio = z.infer<typeof esquemaEditarGimnasio>;

/**
 * Gimnasio tal como lo ve el súper-admin.
 * Las fechas viajan en JSON como texto ISO ("2026-11-17T10:00:00.000Z"), por eso son string.
 */
export interface GimnasioAdmin {
  id: string;
  nombre: string;
  slug: string;
  logoUrl: string | null;
  colorPrimario: string;
  colorSecundario: string;
  activo: boolean;
  creadoEn: string;
  cantidadSocios: number;
  cantidadUsuarios: number;
}

export interface UsuarioResumen {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
}

export interface GimnasioAdminDetalle extends GimnasioAdmin {
  usuarios: UsuarioResumen[];
}
