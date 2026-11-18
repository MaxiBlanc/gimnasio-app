import { z } from 'zod';
import type { CuotaSocio } from './cuotas';
import type { FormaPago } from './pagos';
import { esquemaDni } from './socios';

/** Lo que manda la tablet de ingreso: solo el DNI. */
export const esquemaRegistrarIngreso = z.object({ dni: esquemaDni });
export type DatosRegistrarIngreso = z.infer<typeof esquemaRegistrarIngreso>;

/** Respuesta de la tablet: a quién encontró y en qué estado está su cuota. */
export interface ResultadoIngreso {
  socio: { nombre: string; apellido: string };
  cuota: CuotaSocio;
  /** true si ya había entrado hace poco (no se cuenta dos veces para la ocupación). */
  repetido: boolean;
}

/** Qué tan lleno está el gimnasio. Sin capacidad configurada, no se puede saber: null. */
export type NivelOcupacion = 'BAJA' | 'MEDIA' | 'ALTA';

export interface Ocupacion {
  /** Socios que entraron en los últimos `minutosPermanencia` minutos. */
  personas: number;
  capacidadMaxima: number | null;
  nivel: NivelOcupacion | null;
  minutosPermanencia: number;
}

/** Todo lo que el socio ve en su celular. */
export interface MiCuenta {
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  plan: { nombre: string; precio: number; duracionMeses: number };
  descuento: string | null;
  cuota: CuotaSocio;
  /** Pagos vigentes (sin anulados), del más nuevo al más viejo. */
  pagos: {
    id: string;
    periodoDesde: string;
    periodoHasta: string;
    montoFinal: number;
    formaPago: FormaPago;
    fecha: string;
  }[];
  /** Cuántas veces vino este mes. */
  ingresosDelMes: number;
}

/** Dashboard del dueño: cómo viene el gimnasio. */
export interface Tablero {
  cobrado: { mesActual: number; mesAnterior: number };
  sociosActivos: number;
  altasDelMes: number;
  ingresos: { hoy: number; ultimos7Dias: number };
  /** Entradas por día, de los últimos 14 días (incluye los días sin entradas, en 0). */
  ingresosPorDia: { fecha: string; cantidad: number }[];
  /** Promedio de entradas por hora del día en las últimas 4 semanas (de 0 a 23 h). */
  ingresosPorHora: { hora: number; promedio: number }[];
}
