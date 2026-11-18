import { z } from 'zod';

const texto = (min: number, max: number, campo: string) =>
  z
    .string({ message: `Falta ${campo.toLowerCase()}` })
    .trim()
    .min(min, `${campo}: mínimo ${min} caracteres`)
    .max(max, `${campo}: máximo ${max} caracteres`);

/** Un ejercicio: "Sentadilla, 4 x 8-10, descanso 90 seg". */
export const esquemaEjercicio = z.object({
  nombre: texto(2, 80, 'Ejercicio'),
  series: z.coerce
    .number({ message: 'Series: tiene que ser un número' })
    .int('Series: sin decimales')
    .min(1, 'Series: mínimo 1')
    .max(20, 'Series: máximo 20'),
  // Texto libre porque no siempre son números: "8-12", "al fallo", "30 seg".
  repeticiones: texto(1, 20, 'Repeticiones'),
  descanso: z.string().trim().max(20, 'Descanso: máximo 20 caracteres').default(''),
  notas: z.string().trim().max(200, 'Notas: máximo 200 caracteres').default(''),
});
export type Ejercicio = z.infer<typeof esquemaEjercicio>;

/** Un día de la rutina: "Día 1 · Piernas" con sus ejercicios. */
export const esquemaDiaRutina = z.object({
  nombre: texto(1, 40, 'Nombre del día'),
  ejercicios: z
    .array(esquemaEjercicio)
    .min(1, 'Cada día necesita al menos un ejercicio')
    .max(30, 'Máximo 30 ejercicios por día'),
});
export type DiaRutina = z.infer<typeof esquemaDiaRutina>;

/** Lo que se manda al crear o editar una rutina o una plantilla. */
export const esquemaGuardarRutina = z.object({
  nombre: texto(2, 60, 'Nombre'),
  descripcion: z.string().trim().max(300, 'Descripción: máximo 300 caracteres').default(''),
  dias: z
    .array(esquemaDiaRutina)
    .min(1, 'La rutina necesita al menos un día')
    .max(7, 'Máximo 7 días'),
});
export type DatosGuardarRutina = z.infer<typeof esquemaGuardarRutina>;

/** Asignar una rutina a un socio: copiando una plantilla, o armándola desde cero. */
export const esquemaAsignarRutina = z.union([
  z.object({ plantillaId: z.uuid('Plantilla inválida') }),
  esquemaGuardarRutina,
]);
export type DatosAsignarRutina = z.infer<typeof esquemaAsignarRutina>;

export interface Rutina {
  id: string;
  nombre: string;
  descripcion: string;
  dias: DiaRutina[];
  /** null si es una plantilla. */
  socioId: string | null;
  creadaPor: { nombre: string };
  actualizadoEn: string;
}

/** Fila de la lista de plantillas (sin todo el detalle). */
export interface ResumenRutina {
  id: string;
  nombre: string;
  descripcion: string;
  cantidadDias: number;
  cantidadEjercicios: number;
  creadaPor: { nombre: string };
  actualizadoEn: string;
}
