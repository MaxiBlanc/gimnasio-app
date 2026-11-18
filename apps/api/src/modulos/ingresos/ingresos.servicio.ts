import type {
  DatosRegistrarIngreso,
  NivelOcupacion,
  Ocupacion,
  ResultadoIngreso,
} from '@gimnasio/compartido';
import { prisma } from '../../db';
import { calcularEstadoCuota } from '../../dominio/estadoCuota';
import { fechaATexto } from '../../dominio/periodos';
import { ErrorApp } from '../../errores';
import { obtenerContextoCuotas } from '../socios/socios.servicio';

const MINUTO_MS = 60 * 1000;

/**
 * La tablet de la entrada registra que un socio llegó.
 *
 * - Si la cuota está vencida, IGUAL se registra la entrada: la app avisa, pero la decisión
 *   de dejarlo pasar es del gimnasio (puede que pague en ese momento en recepción).
 * - Si ya había entrado dentro del tiempo de permanencia (por ejemplo, tocó dos veces),
 *   no se registra de nuevo: así no se cuenta dos veces para la ocupación.
 */
export async function registrarIngreso(
  gimnasioId: string,
  { dni }: DatosRegistrarIngreso,
  ahora = new Date(),
): Promise<ResultadoIngreso> {
  const socio = await prisma.socio.findFirst({
    where: { gimnasioId, dni },
    select: {
      id: true,
      nombre: true,
      apellido: true,
      activo: true,
      pagos: {
        where: { anuladoEn: null },
        orderBy: { periodoHasta: 'desc' },
        take: 1,
        select: { periodoHasta: true },
      },
    },
  });
  if (!socio) {
    throw new ErrorApp(404, 'DNI_NO_ENCONTRADO', 'No encontramos ese DNI. Pasá por recepción.');
  }
  if (!socio.activo) {
    throw new ErrorApp(
      409,
      'SOCIO_DADO_DE_BAJA',
      'Tu cuenta está dada de baja. Pasá por recepción.',
    );
  }

  const [{ hoy, config }, gimnasio] = await Promise.all([
    obtenerContextoCuotas(gimnasioId),
    prisma.gimnasio.findUniqueOrThrow({
      where: { id: gimnasioId },
      select: { minutosPermanencia: true },
    }),
  ]);
  const vencimiento = socio.pagos[0]?.periodoHasta ?? null;
  const estado = calcularEstadoCuota(vencimiento, hoy, config);

  const reciente = await prisma.ingreso.findFirst({
    where: {
      socioId: socio.id,
      creadoEn: { gte: new Date(ahora.getTime() - gimnasio.minutosPermanencia * MINUTO_MS) },
    },
    select: { id: true },
  });
  if (!reciente) {
    await prisma.ingreso.create({
      data: { gimnasioId, socioId: socio.id, cuotaVencida: estado === 'VENCIDO', creadoEn: ahora },
    });
  }

  return {
    socio: { nombre: socio.nombre, apellido: socio.apellido },
    cuota: { estado, vencimiento: vencimiento ? fechaATexto(vencimiento) : null },
    repetido: reciente !== null,
  };
}

/** Hasta qué porcentaje de la capacidad se considera ocupación baja o media. */
const LIMITE_BAJA = 0.4;
const LIMITE_MEDIA = 0.75;

export function nivelDeOcupacion(
  personas: number,
  capacidad: number | null,
): NivelOcupacion | null {
  if (!capacidad) return null;
  const proporcion = personas / capacidad;
  if (proporcion < LIMITE_BAJA) return 'BAJA';
  if (proporcion < LIMITE_MEDIA) return 'MEDIA';
  return 'ALTA';
}

/**
 * Ocupación ESTIMADA: no sabemos cuándo se va cada uno (no hay registro de salida), así que
 * suponemos que se queda `minutosPermanencia` (por defecto 90). Contamos cuántos socios
 * distintos entraron en esa ventana.
 */
export async function obtenerOcupacion(gimnasioId: string, ahora = new Date()): Promise<Ocupacion> {
  const { minutosPermanencia, capacidadMaxima } = await prisma.gimnasio.findUniqueOrThrow({
    where: { id: gimnasioId },
    select: { minutosPermanencia: true, capacidadMaxima: true },
  });
  const presentes = await prisma.ingreso.findMany({
    where: {
      gimnasioId,
      creadoEn: { gte: new Date(ahora.getTime() - minutosPermanencia * MINUTO_MS), lte: ahora },
    },
    distinct: ['socioId'],
    select: { socioId: true },
  });
  return {
    personas: presentes.length,
    capacidadMaxima,
    nivel: nivelDeOcupacion(presentes.length, capacidadMaxima),
    minutosPermanencia,
  };
}
