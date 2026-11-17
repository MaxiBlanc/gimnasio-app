import { z } from 'zod';

export const FORMAS_PAGO = ['EFECTIVO', 'TRANSFERENCIA', 'OTRO'] as const;
export type FormaPago = (typeof FORMAS_PAGO)[number];

export const NOMBRES_FORMA_PAGO: Record<FormaPago, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  OTRO: 'Otro',
};

/** Mes en formato "AAAA-MM" (ej. "2026-11"). */
export const esquemaMes = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mes inválido: usá el formato AAAA-MM');

/**
 * Registrar un pago. El monto NO lo manda el cliente: lo calcula la API con el plan y el
 * descuento del socio. Así nadie puede registrar un pago por un monto inventado.
 * `desde` es opcional: si no viene, se cobra el primer mes que corresponde.
 */
export const esquemaRegistrarPago = z.object({
  formaPago: z.enum(FORMAS_PAGO, { message: 'Elegí la forma de pago' }),
  desde: esquemaMes.optional(),
});
export type DatosRegistrarPago = z.infer<typeof esquemaRegistrarPago>;

export const esquemaVistaPreviaPago = z.object({ desde: esquemaMes.optional() });

export const esquemaAnularPago = z.object({
  motivo: z
    .string()
    .trim()
    .min(5, 'Contá brevemente por qué se anula (mínimo 5 caracteres)')
    .max(200),
});
export type DatosAnularPago = z.infer<typeof esquemaAnularPago>;

/** Lo que se va a cobrar, antes de confirmar. La web lo muestra en el formulario de cobro. */
export interface VistaPreviaPago {
  plan: { id: string; nombre: string; duracionMeses: number };
  descuentoNombre: string | null;
  /** "AAAA-MM-DD" */
  periodoDesde: string;
  periodoHasta: string;
  montoBase: number;
  montoDescuento: number;
  montoFinal: number;
}

export interface Pago {
  id: string;
  periodoDesde: string;
  periodoHasta: string;
  montoBase: number;
  montoDescuento: number;
  montoFinal: number;
  descuentoNombre: string | null;
  formaPago: FormaPago;
  plan: { id: string; nombre: string };
  registradoPor: { nombre: string };
  creadoEn: string;
  anulacion: { fecha: string; motivo: string; por: { nombre: string } } | null;
}
