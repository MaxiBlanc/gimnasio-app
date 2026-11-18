import type { ClaseEnFecha } from '@gimnasio/compartido';

const formatoDia = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC', // la fecha "AAAA-MM-DD" ya es de Argentina: no la corremos de zona
});

const hoyTexto = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(
    new Date(),
  );

/** "Hoy", "Mañana" o "jueves 19 de noviembre". */
export function tituloDeFecha(fecha: string): string {
  const hoy = hoyTexto();
  const manana = new Date(`${hoy}T00:00:00Z`);
  manana.setUTCDate(manana.getUTCDate() + 1);
  if (fecha === hoy) return 'Hoy';
  if (fecha === manana.toISOString().slice(0, 10)) return 'Mañana';
  return formatoDia.format(new Date(`${fecha}T00:00:00Z`));
}

/** Agrupa las clases por fecha, respetando el orden en que vienen (ya ordenadas por hora). */
export function agruparPorFecha(clases: ClaseEnFecha[]): [string, ClaseEnFecha[]][] {
  const grupos = new Map<string, ClaseEnFecha[]>();
  for (const clase of clases) {
    grupos.set(clase.fecha, [...(grupos.get(clase.fecha) ?? []), clase]);
  }
  return [...grupos];
}
