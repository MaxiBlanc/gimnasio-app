import { z } from 'zod';
import { esquemaContrasenaNueva } from './gimnasios';

const texto = (min: number, max: number, campo: string) =>
  z
    .string({ message: `Falta ${campo}` })
    .trim()
    .min(min, `${campo}: mínimo ${min} caracteres`)
    .max(max, `${campo}: máximo ${max} caracteres`);

/** DNI: acepta "30.111.222" o "30 111 222" y lo guarda como "30111222". */
export const esquemaDni = z
  .string({ message: 'Falta el DNI' })
  .transform((dni) => dni.replace(/[.\s]/g, ''))
  .pipe(z.string().regex(/^\d{7,8}$/, 'El DNI debe tener 7 u 8 números'));

const esquemaTelefono = (campo: string) =>
  texto(6, 30, campo).regex(/^[\d\s+()-]+$/, `${campo}: solo números, espacios y + ( ) -`);

const camposSocio = {
  nombre: texto(2, 60, 'Nombre'),
  apellido: texto(2, 60, 'Apellido'),
  dni: esquemaDni,
  telefono: esquemaTelefono('Teléfono'),
  email: z.string().trim().toLowerCase().pipe(z.email('Email inválido')),
  emergenciaNombre: texto(2, 80, 'Contacto de emergencia'),
  emergenciaTelefono: esquemaTelefono('Teléfono de emergencia'),
  planId: z.uuid('Elegí un plan'),
  descuentoId: z.uuid('Descuento inválido').nullable().optional(),
};

export const esquemaCrearSocio = z.object(camposSocio);
export type DatosCrearSocio = z.infer<typeof esquemaCrearSocio>;

/** Edición parcial. `activo: false` = dar de baja (baja lógica: no se borra nada). */
export const esquemaEditarSocio = z
  .object({ ...camposSocio, activo: z.boolean() })
  .partial()
  .refine((datos) => Object.keys(datos).length > 0, 'No hay nada para modificar');
export type DatosEditarSocio = z.infer<typeof esquemaEditarSocio>;

/**
 * Filtros del listado. Llegan por la URL (?busqueda=juan&pagina=2), así que todo viene como
 * texto: `z.coerce.number()` convierte "2" en 2.
 */
export const esquemaFiltrosSocios = z.object({
  busqueda: z.string().trim().max(100).optional(),
  incluirBajas: z
    .enum(['true', 'false'])
    .optional()
    .transform((valor) => valor === 'true'),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(20),
});
export type FiltrosSocios = z.infer<typeof esquemaFiltrosSocios>;

/** Activación de la cuenta: el socio llega con el token del mail y elige su contraseña. */
export const esquemaActivarCuenta = z.object({
  token: z.string().min(20, 'Enlace inválido'),
  contrasena: esquemaContrasenaNueva,
});
export type DatosActivarCuenta = z.infer<typeof esquemaActivarCuenta>;

export interface Socio {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  email: string;
  emergenciaNombre: string;
  emergenciaTelefono: string;
  activo: boolean;
  /** true cuando el socio ya creó su contraseña. */
  cuentaActivada: boolean;
  plan: { id: string; nombre: string };
  descuento: { id: string; nombre: string } | null;
  creadoEn: string;
}

/** Respuesta paginada genérica: `Pagina<Socio>`, más adelante `Pagina<Pago>`, etc. */
export interface Pagina<T> {
  datos: T[];
  total: number;
  pagina: number;
  porPagina: number;
}

export interface RespuestaAltaSocio {
  socio: Socio;
  /** false si el mail de activación no se pudo enviar (se puede reenviar después). */
  correoEnviado: boolean;
}
