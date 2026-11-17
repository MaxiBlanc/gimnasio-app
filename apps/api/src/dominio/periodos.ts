/**
 * Funciones puras para trabajar con meses calendario (sin base de datos ni Express).
 *
 * Las columnas `periodo_desde` / `periodo_hasta` son de tipo DATE (sin hora). Prisma las
 * representa como Date a las 00:00 UTC, así que acá todo se calcula en UTC para que un
 * cambio de zona horaria nunca mueva un día.
 */

export const ZONA_HORARIA = 'America/Argentina/Buenos_Aires';

/** Un mes concreto del calendario. `mes` va de 1 (enero) a 12 (diciembre). */
export interface MesCalendario {
  anio: number;
  mes: number;
}

/** Primer día del mes (ej. 2026-11-01). */
export function inicioDeMes({ anio, mes }: MesCalendario): Date {
  return new Date(Date.UTC(anio, mes - 1, 1));
}

/** Último día del mes (ej. 2026-11-30). El "día 0" del mes siguiente es el último del actual. */
export function finDeMes({ anio, mes }: MesCalendario): Date {
  return new Date(Date.UTC(anio, mes, 0));
}

/** Suma (o resta, con n negativo) meses: sumarMeses({2026, 11}, 3) → {2027, 2}. */
export function sumarMeses({ anio, mes }: MesCalendario, n: number): MesCalendario {
  const indice = anio * 12 + (mes - 1) + n;
  return { anio: Math.floor(indice / 12), mes: (indice % 12) + 1 };
}

/** Mes al que pertenece una fecha DATE (leída en UTC). */
export function mesDeFecha(fecha: Date): MesCalendario {
  return { anio: fecha.getUTCFullYear(), mes: fecha.getUTCMonth() + 1 };
}

/** Fecha de "hoy" en Argentina, como DATE (00:00 UTC), sin importar la zona del servidor. */
export function hoyEnArgentina(ahora: Date = new Date()): Date {
  // 'en-CA' formatea como AAAA-MM-DD.
  const texto = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA }).format(ahora);
  return new Date(`${texto}T00:00:00Z`);
}

/** Período que cubre un pago: desde el 1° del mes inicial hasta el último día del mes final. */
export function periodoDePago(desde: MesCalendario, duracionMeses: number) {
  if (!Number.isInteger(duracionMeses) || duracionMeses < 1) {
    throw new Error('La duración debe ser un entero mayor o igual a 1');
  }
  return {
    periodoDesde: inicioDeMes(desde),
    periodoHasta: finDeMes(sumarMeses(desde, duracionMeses - 1)),
  };
}
