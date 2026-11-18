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

// ───────────── Configuración que el DUEÑO maneja de su propio gimnasio ─────────────

/** Mismos límites que los CHECK de la base de datos. */
export const esquemaConfiguracionGimnasio = z
  .object({
    logoUrl: camposGimnasio.logoUrl,
    colorPrimario: esquemaColor,
    colorSecundario: esquemaColor,
    diaCierreCobro: z.number().int().min(1, 'Entre 1 y 28').max(28, 'Entre 1 y 28'),
    diasAvisoVencimiento: z.number().int().min(0, 'Entre 0 y 28').max(28, 'Entre 0 y 28'),
    minutosPermanencia: z.number().int().min(15, 'Mínimo 15 minutos').max(600, 'Máximo 10 horas'),
    capacidadMaxima: z.number().int().positive('Debe ser mayor a 0').max(10_000).nullable(),
  })
  .partial()
  .refine((datos) => Object.keys(datos).length > 0, 'No hay nada para modificar');
export type DatosConfiguracionGimnasio = z.infer<typeof esquemaConfiguracionGimnasio>;

export interface ConfiguracionGimnasio {
  id: string;
  nombre: string;
  slug: string;
  logoUrl: string | null;
  colorPrimario: string;
  colorSecundario: string;
  /** Día del mes a partir del cual (el día siguiente) una cuota impaga está vencida. */
  diaCierreCobro: number;
  /** Días antes de fin de mes en que la cuota pasa a "por vencer". */
  diasAvisoVencimiento: number;
  /** Minutos que un ingreso cuenta como "presente" para la ocupación. */
  minutosPermanencia: number;
  capacidadMaxima: number | null;
}

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
  roles: Rol[];
  activo: boolean;
}

export interface GimnasioAdminDetalle extends GimnasioAdmin {
  usuarios: UsuarioResumen[];
}
