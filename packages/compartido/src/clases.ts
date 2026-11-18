import { z } from 'zod';

/** 1 = lunes … 7 = domingo (norma ISO). */
export const NOMBRES_DIA_SEMANA = [
  '',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
] as const;

const camposClase = {
  nombre: z
    .string({ message: 'Falta el nombre' })
    .trim()
    .min(2, 'Nombre: mínimo 2 caracteres')
    .max(60, 'Nombre: máximo 60 caracteres'),
  profesorId: z.uuid('Profesor inválido').nullable().default(null),
  diaSemana: z.coerce.number().int().min(1, 'Elegí el día').max(7, 'Elegí el día'),
  horaInicio: z
    .string({ message: 'Falta la hora' })
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (ej. 19:00)'),
  duracionMinutos: z.coerce
    .number({ message: 'Duración: tiene que ser un número' })
    .int()
    .min(15, 'Duración: mínimo 15 minutos')
    .max(240, 'Duración: máximo 240 minutos'),
  cupo: z.coerce
    .number({ message: 'Cupo: tiene que ser un número' })
    .int('Cupo: sin decimales')
    .min(1, 'Cupo: mínimo 1')
    .max(200, 'Cupo: máximo 200'),
};

export const esquemaCrearClase = z.object(camposClase);
export type DatosCrearClase = z.infer<typeof esquemaCrearClase>;

export const esquemaEditarClase = z
  .object({ ...camposClase, activa: z.boolean() })
  .partial()
  .refine((datos) => Object.keys(datos).length > 0, 'No hay nada para cambiar');
export type DatosEditarClase = z.infer<typeof esquemaEditarClase>;

/** Fecha de una clase concreta, "AAAA-MM-DD" (para anotarse o darse de baja). */
export const esquemaFechaClase = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
});

export interface Clase {
  id: string;
  nombre: string;
  profesor: { id: string; nombre: string } | null;
  diaSemana: number;
  horaInicio: string;
  duracionMinutos: number;
  cupo: number;
  activa: boolean;
}

/** Una clase en una fecha concreta, con cuántos lugares quedan. */
export interface ClaseEnFecha {
  claseId: string;
  nombre: string;
  profesor: string | null;
  fecha: string;
  horaInicio: string;
  duracionMinutos: number;
  cupo: number;
  inscriptos: number;
  /** Solo en la vista del socio: si él está anotado. */
  anotado?: boolean;
  /** Solo en la vista del personal: quiénes se anotaron. */
  socios?: { nombre: string; apellido: string }[];
}
