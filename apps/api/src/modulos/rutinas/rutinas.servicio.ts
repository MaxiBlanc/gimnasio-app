import { z } from 'zod';
import {
  esquemaDiaRutina,
  type DatosAsignarRutina,
  type DatosGuardarRutina,
  type ResumenRutina,
  type Rutina,
} from '@gimnasio/compartido';
import { prisma } from '../../db';
import { ErrorApp } from '../../errores';
import type { Prisma } from '../../generated/prisma/client';

const seleccionRutina = {
  id: true,
  nombre: true,
  descripcion: true,
  dias: true,
  socioId: true,
  actualizadoEn: true,
  creadaPor: { select: { nombre: true } },
} satisfies Prisma.RutinaSelect;

type RutinaDeBase = Prisma.RutinaGetPayload<{ select: typeof seleccionRutina }>;

/**
 * La columna `dias` es JSON: para Prisma es un valor cualquiera (`JsonValue`).
 * Lo validamos con el mismo esquema de Zod que se usó al guardarlo; así el resto del código
 * trabaja con un tipo exacto y, si alguien tocara la base a mano, nos enteramos acá.
 */
const esquemaDias = z.array(esquemaDiaRutina);

function aRutina({ dias, actualizadoEn, ...rutina }: RutinaDeBase): Rutina {
  return { ...rutina, dias: esquemaDias.parse(dias), actualizadoEn: actualizadoEn.toISOString() };
}

function aResumen(rutina: RutinaDeBase): ResumenRutina {
  const { id, nombre, descripcion, creadaPor, actualizadoEn, dias } = aRutina(rutina);
  return {
    id,
    nombre,
    descripcion,
    creadaPor,
    actualizadoEn,
    cantidadDias: dias.length,
    cantidadEjercicios: dias.reduce((total, dia) => total + dia.ejercicios.length, 0),
  };
}

const rutinaNoEncontrada = () => new ErrorApp(404, 'RUTINA_NO_ENCONTRADA', 'No existe esa rutina');

// ─────────────────────────────── Plantillas ───────────────────────────────

export async function listarPlantillas(gimnasioId: string): Promise<ResumenRutina[]> {
  const plantillas = await prisma.rutina.findMany({
    where: { gimnasioId, socioId: null },
    select: seleccionRutina,
    orderBy: { nombre: 'asc' },
  });
  return plantillas.map(aResumen);
}

export async function crearPlantilla(
  gimnasioId: string,
  creadaPorId: string,
  datos: DatosGuardarRutina,
): Promise<Rutina> {
  const rutina = await prisma.rutina.create({
    data: { ...datos, gimnasioId, creadaPorId },
    select: seleccionRutina,
  });
  return aRutina(rutina);
}

// ───────────────────────── Cualquier rutina (por id) ─────────────────────────

export async function obtenerRutina(gimnasioId: string, id: string): Promise<Rutina> {
  const rutina = await prisma.rutina.findFirst({
    where: { id, gimnasioId },
    select: seleccionRutina,
  });
  if (!rutina) throw rutinaNoEncontrada();
  return aRutina(rutina);
}

/** Editar reemplaza la rutina entera (nombre, descripción y todos los días). */
export async function editarRutina(
  gimnasioId: string,
  id: string,
  datos: DatosGuardarRutina,
): Promise<Rutina> {
  // updateMany con gimnasioId en el where: si el id es de otro gimnasio, no toca nada.
  const { count } = await prisma.rutina.updateMany({ where: { id, gimnasioId }, data: datos });
  if (count === 0) throw rutinaNoEncontrada();
  return obtenerRutina(gimnasioId, id);
}

export async function eliminarRutina(gimnasioId: string, id: string): Promise<void> {
  const { count } = await prisma.rutina.deleteMany({ where: { id, gimnasioId } });
  if (count === 0) throw rutinaNoEncontrada();
}

// ─────────────────────────────── De un socio ───────────────────────────────

async function verificarSocio(gimnasioId: string, socioId: string) {
  const socio = await prisma.socio.findFirst({
    where: { id: socioId, gimnasioId },
    select: { activo: true },
  });
  if (!socio) throw new ErrorApp(404, 'SOCIO_NO_ENCONTRADO', 'No existe ese socio');
  return socio;
}

/** Rutinas de un socio, la más nueva primero. */
export async function listarRutinasDeSocio(gimnasioId: string, socioId: string): Promise<Rutina[]> {
  await verificarSocio(gimnasioId, socioId);
  const rutinas = await prisma.rutina.findMany({
    where: { gimnasioId, socioId },
    select: seleccionRutina,
    orderBy: { actualizadoEn: 'desc' },
  });
  return rutinas.map(aRutina);
}

/**
 * Le asigna una rutina a un socio. Si viene `plantillaId`, se COPIA la plantilla:
 * la rutina del socio queda independiente, y cambiar la plantilla después no la afecta
 * (ni al revés). Si no, se arma desde cero con los datos que vienen.
 */
export async function asignarRutina(
  gimnasioId: string,
  socioId: string,
  creadaPorId: string,
  datos: DatosAsignarRutina,
): Promise<Rutina> {
  const socio = await verificarSocio(gimnasioId, socioId);
  if (!socio.activo) throw new ErrorApp(409, 'SOCIO_DADO_DE_BAJA', 'El socio está dado de baja');

  let contenido: DatosGuardarRutina;
  if ('plantillaId' in datos) {
    const plantilla = await prisma.rutina.findFirst({
      where: { id: datos.plantillaId, gimnasioId, socioId: null },
      select: seleccionRutina,
    });
    if (!plantilla) throw new ErrorApp(404, 'PLANTILLA_NO_ENCONTRADA', 'No existe esa plantilla');
    const { nombre, descripcion, dias } = aRutina(plantilla);
    contenido = { nombre, descripcion, dias };
  } else {
    contenido = datos;
  }

  const rutina = await prisma.rutina.create({
    data: { ...contenido, gimnasioId, socioId, creadaPorId },
    select: seleccionRutina,
  });
  return aRutina(rutina);
}
