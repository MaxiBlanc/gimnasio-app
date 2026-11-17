export const ESTADOS_CUOTA = ['AL_DIA', 'POR_VENCER', 'PENDIENTE', 'VENCIDO'] as const;
export type EstadoCuota = (typeof ESTADOS_CUOTA)[number];

export const NOMBRES_ESTADO_CUOTA: Record<EstadoCuota, string> = {
  AL_DIA: 'Al día',
  POR_VENCER: 'Por vencer',
  PENDIENTE: 'Pendiente',
  VENCIDO: 'Vencido',
};

export interface CuotaSocio {
  estado: EstadoCuota;
  /** Último día pagado ("AAAA-MM-DD"), o null si nunca pagó. */
  vencimiento: string | null;
}

/** Cantidad de socios activos en cada estado (para los filtros del listado). */
export type ResumenCuotas = Record<EstadoCuota, number>;
