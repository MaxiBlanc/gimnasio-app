import type { EstadoCuota } from '@gimnasio/compartido';
import { finDeMes, mesDeFecha } from './periodos';

/**
 * Estado de la cuota de un socio. Función pura: recibe "hoy" como parámetro en vez de
 * leer el reloj, así los tests pueden probar cualquier fecha.
 *
 * Reglas (la cuota se paga por mes calendario):
 * - AL_DIA:     tiene pagado el mes actual.
 * - POR_VENCER: tiene pagado el mes actual pero NO el siguiente, y faltan `diasAviso`
 *               días o menos para fin de mes.
 * - PENDIENTE:  no tiene pagado el mes actual, pero todavía no pasó el día de cierre.
 * - VENCIDO:    no tiene pagado el mes actual y ya pasó el día de cierre.
 */

export interface ConfigCuotas {
  /** Día del mes a partir del cual (el día siguiente) una cuota impaga está vencida. */
  diaCierreCobro: number;
  /** Cuántos días antes de fin de mes se avisa "por vencer". */
  diasAvisoVencimiento: number;
}

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Pensado para usarse también al armar filtros de base de datos (ver socios.servicio.ts):
 * dice qué fechas importan HOY, para no repetir las reglas en dos lugares.
 */
export function limitesDeHoy(hoy: Date, config: ConfigCuotas) {
  const finMesActual = finDeMes(mesDeFecha(hoy));
  const diasHastaFinDeMes = Math.round((finMesActual.getTime() - hoy.getTime()) / DIA_MS);
  return {
    finMesActual,
    /** ¿Estamos en los últimos días del mes, cuando se avisa "por vencer"? */
    enPeriodoDeAviso: diasHastaFinDeMes <= config.diasAvisoVencimiento,
    /** ¿Ya pasó el día de cierre de cobro de este mes? */
    pasoElCierre: hoy.getUTCDate() > config.diaCierreCobro,
  };
}

export function calcularEstadoCuota(
  vencimiento: Date | null,
  hoy: Date,
  config: ConfigCuotas,
): EstadoCuota {
  const { finMesActual, enPeriodoDeAviso, pasoElCierre } = limitesDeHoy(hoy, config);

  const pagoEsteMes = vencimiento !== null && vencimiento >= finMesActual;
  if (!pagoEsteMes) return pasoElCierre ? 'VENCIDO' : 'PENDIENTE';

  const pagoElSiguiente = vencimiento > finMesActual;
  return !pagoElSiguiente && enPeriodoDeAviso ? 'POR_VENCER' : 'AL_DIA';
}
