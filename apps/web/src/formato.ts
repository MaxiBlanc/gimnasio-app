/**
 * Formatos para mostrar en pantalla. Las fechas de la API vienen como "AAAA-MM-DD" (sin hora):
 * las armamos a mano en vez de usar `new Date("2026-11-30")`, que las interpreta en UTC y en
 * Argentina (UTC-3) mostraría el 29.
 */

const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** 30000 → "$ 30.000" */
export function formatearPesos(monto: number): string {
  return pesos.format(monto);
}

/** Un descuento en pocas palabras: "10 %" o "-$ 2.000". */
export function textoDescuento(descuento: { tipo: 'PORCENTAJE' | 'MONTO_FIJO'; valor: number }) {
  return descuento.tipo === 'PORCENTAJE'
    ? `${descuento.valor} %`
    : `-${formatearPesos(descuento.valor)}`;
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

function partes(fecha: string) {
  const [anio = '', mes = '', dia = ''] = fecha.slice(0, 10).split('-');
  return { anio, mes: Number(mes), dia: Number(dia) };
}

/** "2026-11-30" → "30/11/2026" */
export function formatearFecha(fecha: string): string {
  const { anio, mes, dia } = partes(fecha);
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${anio}`;
}

/** "2026-11-01" → "noviembre 2026" */
export function formatearMes(fecha: string): string {
  const { anio, mes } = partes(fecha);
  return `${MESES[mes - 1]} ${anio}`;
}

/** Período de un pago: "noviembre 2026" o "noviembre 2026 a enero 2027". */
export function formatearPeriodo(desde: string, hasta: string): string {
  const inicio = formatearMes(desde);
  const fin = formatearMes(hasta);
  return inicio === fin ? inicio : `${inicio} a ${fin}`;
}

/** Fecha y hora de un instante ISO, en hora argentina: "17/11/2026 08:30". */
const fechaHora = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'America/Argentina/Buenos_Aires',
});
export function formatearFechaHora(instante: string): string {
  return fechaHora.format(new Date(instante)).replace(',', '');
}

/** "2026-11-01" → "2026-11" (el formato de <input type="month">). */
export function aMes(fecha: string): string {
  return fecha.slice(0, 7);
}
