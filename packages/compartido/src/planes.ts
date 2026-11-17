import { z } from 'zod';

/**
 * Monto en pesos: positivo, con hasta 2 decimales.
 * En la base es DECIMAL(12,2), así que el máximo es 9.999.999.999,99.
 */
export const esquemaMonto = z
  .number({ message: 'Debe ser un número' })
  .nonnegative('No puede ser negativo')
  .max(9_999_999_999.99, 'Monto demasiado grande')
  // Comparamos en centavos: 30000.5 * 100 = 3000050 (entero) ✔; 10.123 * 100 no lo es ✘.
  .refine((monto) => Math.abs(monto * 100 - Math.round(monto * 100)) < 1e-6, {
    message: 'Máximo 2 decimales',
  });

const nombre = z.string().trim().min(2, 'Mínimo 2 caracteres').max(60, 'Máximo 60 caracteres');

// ───────────────────────────── Planes ─────────────────────────────

export const esquemaCrearPlan = z.object({
  nombre,
  precio: esquemaMonto,
  duracionMeses: z
    .number()
    .int('Debe ser un número entero de meses')
    .min(1, 'Mínimo 1 mes')
    .max(24, 'Máximo 24 meses'),
});
export type DatosCrearPlan = z.infer<typeof esquemaCrearPlan>;

export const esquemaEditarPlan = esquemaCrearPlan
  .extend({ activo: z.boolean() })
  .partial()
  .refine((datos) => Object.keys(datos).length > 0, 'No hay nada para modificar');
export type DatosEditarPlan = z.infer<typeof esquemaEditarPlan>;

export interface Plan {
  id: string;
  nombre: string;
  /** Pesos. Se envía como number para simplificar el front; en la base es DECIMAL. */
  precio: number;
  duracionMeses: number;
  activo: boolean;
  cantidadSocios: number;
}

// ───────────────────────────── Descuentos ─────────────────────────────

export const TIPOS_DESCUENTO = ['PORCENTAJE', 'MONTO_FIJO'] as const;
export type TipoDescuento = (typeof TIPOS_DESCUENTO)[number];

/**
 * Regla que cruza dos campos: un porcentaje no puede superar 100.
 * Está en una función aparte porque la usan el alta y la edición.
 */
export function problemaValorDescuento(tipo: TipoDescuento, valor: number): string | null {
  if (valor <= 0) return 'El valor debe ser mayor a 0';
  if (tipo === 'PORCENTAJE' && valor > 100) return 'Un porcentaje no puede superar 100';
  return null;
}

export const esquemaCrearDescuento = z
  .object({ nombre, tipo: z.enum(TIPOS_DESCUENTO), valor: esquemaMonto })
  .superRefine(({ tipo, valor }, ctx) => {
    const problema = problemaValorDescuento(tipo, valor);
    if (problema) ctx.addIssue({ code: 'custom', path: ['valor'], message: problema });
  });
export type DatosCrearDescuento = z.infer<typeof esquemaCrearDescuento>;

/** En la edición, la regla tipo/valor se valida en el servicio, combinando con lo guardado. */
export const esquemaEditarDescuento = z
  .object({ nombre, tipo: z.enum(TIPOS_DESCUENTO), valor: esquemaMonto, activo: z.boolean() })
  .partial()
  .refine((datos) => Object.keys(datos).length > 0, 'No hay nada para modificar');
export type DatosEditarDescuento = z.infer<typeof esquemaEditarDescuento>;

export interface Descuento {
  id: string;
  nombre: string;
  tipo: TipoDescuento;
  /** Si es PORCENTAJE: 10 = 10 %. Si es MONTO_FIJO: pesos. */
  valor: number;
  activo: boolean;
  cantidadSocios: number;
}
