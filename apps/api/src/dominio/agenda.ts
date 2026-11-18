import { fechaATexto, hoyEnArgentina } from './periodos';

/** Cuántos días para adelante se muestran (y se aceptan inscripciones). */
export const DIAS_AGENDA = 7;

const DIA_MS = 24 * 60 * 60 * 1000;
/** Argentina está en UTC-3 todo el año: las 19:00 de allá son las 22:00 UTC. */
const DESFASE_ARGENTINA_MS = 3 * 60 * 60 * 1000;

/** 1 = lunes … 7 = domingo, para una fecha "de calendario" (00:00 UTC). */
export function diaSemanaIso(fecha: Date): number {
  return ((fecha.getUTCDay() + 6) % 7) + 1;
}

/** Instante en que empieza una clase: fecha "AAAA-MM-DD" + hora "HH:MM" de Argentina. */
export function inicioDeClase(fecha: string, horaInicio: string): Date {
  const [horas = 0, minutos = 0] = horaInicio.split(':').map(Number);
  const base = new Date(`${fecha}T00:00:00Z`).getTime();
  return new Date(base + (horas * 60 + minutos) * 60 * 1000 + DESFASE_ARGENTINA_MS);
}

export interface ClaseSemanal {
  id: string;
  diaSemana: number;
  horaInicio: string;
}

/**
 * Las clases que vienen en los próximos `DIAS_AGENDA` días, en orden. Función pura
 * (recibe "ahora"), así se puede probar cualquier momento de la semana.
 * Las que ya empezaron no aparecen: no tiene sentido anotarse a una clase en curso.
 */
export function proximasClases<T extends ClaseSemanal>(
  clases: T[],
  ahora: Date,
): { clase: T; fecha: string; inicio: Date }[] {
  const hoy = hoyEnArgentina(ahora);
  const resultado: { clase: T; fecha: string; inicio: Date }[] = [];
  for (let i = 0; i < DIAS_AGENDA; i++) {
    const dia = new Date(hoy.getTime() + i * DIA_MS);
    const fecha = fechaATexto(dia);
    for (const clase of clases) {
      if (clase.diaSemana !== diaSemanaIso(dia)) continue;
      const inicio = inicioDeClase(fecha, clase.horaInicio);
      if (inicio > ahora) resultado.push({ clase, fecha, inicio });
    }
  }
  return resultado.sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
}
