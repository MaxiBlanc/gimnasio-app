import type { Clase, ClaseEnFecha, DatosCrearClase, DatosEditarClase } from '@gimnasio/compartido';
import { prisma } from '../../db';
import { DIAS_AGENDA, inicioDeClase, proximasClases } from '../../dominio/agenda';
import { calcularEstadoCuota } from '../../dominio/estadoCuota';
import { hoyEnArgentina } from '../../dominio/periodos';
import { ErrorApp } from '../../errores';
import { esViolacionDeUnicidad } from '../../erroresBase';
import type { Prisma } from '../../generated/prisma/client';
import { Rol } from '../../generated/prisma/enums';
import { obtenerContextoCuotas } from '../socios/socios.servicio';

const DIA_MS = 24 * 60 * 60 * 1000;

const seleccionClase = {
  id: true,
  nombre: true,
  diaSemana: true,
  horaInicio: true,
  duracionMinutos: true,
  cupo: true,
  activa: true,
  profesor: { select: { id: true, nombre: true } },
} satisfies Prisma.ClaseSelect;

const claseNoEncontrada = () => new ErrorApp(404, 'CLASE_NO_ENCONTRADA', 'No existe esa clase');

/** Quién puede dar una clase: un profe o el dueño, activos y del mismo gimnasio. */
async function verificarProfesor(gimnasioId: string, profesorId: string | null | undefined) {
  if (!profesorId) return;
  const profesor = await prisma.usuario.findFirst({
    where: {
      id: profesorId,
      gimnasioId,
      activo: true,
      roles: { hasSome: [Rol.PROFESOR, Rol.DUENO] },
    },
    select: { id: true },
  });
  if (!profesor) throw new ErrorApp(400, 'PROFESOR_INVALIDO', 'Ese profesor no existe');
}

// ───────────────────────────── Administración ─────────────────────────────

export async function listarClases(gimnasioId: string): Promise<Clase[]> {
  return prisma.clase.findMany({
    where: { gimnasioId },
    select: seleccionClase,
    orderBy: [{ activa: 'desc' }, { diaSemana: 'asc' }, { horaInicio: 'asc' }],
  });
}

/** Para el selector de "quién la da". */
export async function listarProfesores(gimnasioId: string) {
  return prisma.usuario.findMany({
    where: { gimnasioId, activo: true, roles: { hasSome: [Rol.PROFESOR, Rol.DUENO] } },
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
  });
}

export async function crearClase(gimnasioId: string, datos: DatosCrearClase): Promise<Clase> {
  await verificarProfesor(gimnasioId, datos.profesorId);
  return prisma.clase.create({ data: { ...datos, gimnasioId }, select: seleccionClase });
}

export async function editarClase(
  gimnasioId: string,
  id: string,
  datos: DatosEditarClase,
): Promise<Clase> {
  await verificarProfesor(gimnasioId, datos.profesorId);
  const { count } = await prisma.clase.updateMany({ where: { id, gimnasioId }, data: datos });
  if (count === 0) throw claseNoEncontrada();
  return prisma.clase.findUniqueOrThrow({ where: { id }, select: seleccionClase });
}

// ───────────────────────────────── Agenda ─────────────────────────────────

/** Las clases activas de los próximos días, con sus inscripciones en esas fechas. */
async function armarAgenda(gimnasioId: string, ahora: Date) {
  const clases = await prisma.clase.findMany({
    where: { gimnasioId, activa: true },
    select: seleccionClase,
  });
  const hoy = hoyEnArgentina(ahora);
  const inscripciones = await prisma.inscripcion.findMany({
    where: {
      gimnasioId,
      fecha: { gte: hoy, lt: new Date(hoy.getTime() + DIAS_AGENDA * DIA_MS) },
    },
    select: {
      claseId: true,
      fecha: true,
      socioId: true,
      socio: { select: { nombre: true, apellido: true } },
    },
    orderBy: { creadoEn: 'asc' },
  });
  return proximasClases(clases, ahora).map(({ clase, fecha }) => ({
    clase,
    fecha,
    inscripciones: inscripciones.filter(
      (i) => i.claseId === clase.id && i.fecha.toISOString().startsWith(fecha),
    ),
  }));
}

function aClaseEnFecha({ clase, fecha }: { clase: Clase; fecha: string }, inscriptos: number) {
  return {
    claseId: clase.id,
    nombre: clase.nombre,
    profesor: clase.profesor?.nombre ?? null,
    fecha,
    horaInicio: clase.horaInicio,
    duracionMinutos: clase.duracionMinutos,
    cupo: clase.cupo,
    inscriptos,
  } satisfies ClaseEnFecha;
}

/** Para el personal: cada clase con la lista de anotados. */
export async function agendaDelPersonal(
  gimnasioId: string,
  ahora = new Date(),
): Promise<ClaseEnFecha[]> {
  const agenda = await armarAgenda(gimnasioId, ahora);
  return agenda.map((item) => ({
    ...aClaseEnFecha(item, item.inscripciones.length),
    socios: item.inscripciones.map((i) => i.socio),
  }));
}

/** Para el socio: cada clase con cuántos lugares quedan y si él está anotado (sin nombres ajenos). */
export async function agendaDelSocio(
  gimnasioId: string,
  socioId: string,
  ahora = new Date(),
): Promise<ClaseEnFecha[]> {
  const agenda = await armarAgenda(gimnasioId, ahora);
  return agenda.map((item) => ({
    ...aClaseEnFecha(item, item.inscripciones.length),
    anotado: item.inscripciones.some((i) => i.socioId === socioId),
  }));
}

// ─────────────────────────────── Inscripción ───────────────────────────────

/** Verifica que la clase exista, esté activa y que esa fecha sea una próxima clase. */
async function buscarClaseEnFecha(gimnasioId: string, claseId: string, fecha: string, ahora: Date) {
  const clase = await prisma.clase.findFirst({
    where: { id: claseId, gimnasioId, activa: true },
    select: { id: true, diaSemana: true, horaInicio: true, cupo: true },
  });
  if (!clase) throw claseNoEncontrada();
  const proxima = proximasClases([clase], ahora).some((p) => p.fecha === fecha);
  if (!proxima) {
    throw new ErrorApp(
      400,
      'FECHA_INVALIDA',
      'Esa clase no es en esa fecha, ya empezó o todavía no abrió la inscripción',
    );
  }
  return clase;
}

/**
 * Anotar a un socio. Lo delicado es el CUPO: si quedan 1 lugar y dos socios tocan "anotarme"
 * al mismo tiempo, los dos podrían contar "14 de 15" y entrar los dos.
 * Para evitarlo, dentro de una transacción BLOQUEAMOS la fila de la clase (SELECT … FOR UPDATE):
 * el segundo pedido espera a que termine el primero, y recién ahí cuenta (y ve 15 de 15).
 */
export async function anotarse(
  gimnasioId: string,
  socioId: string,
  claseId: string,
  fecha: string,
  ahora = new Date(),
): Promise<void> {
  const clase = await buscarClaseEnFecha(gimnasioId, claseId, fecha, ahora);

  // Con la cuota vencida no se puede reservar lugar (sí puede pagar y anotarse después).
  const [{ hoy, config }, ultimoPago] = await Promise.all([
    obtenerContextoCuotas(gimnasioId),
    prisma.pago.findFirst({
      where: { socioId, anuladoEn: null },
      orderBy: { periodoHasta: 'desc' },
      select: { periodoHasta: true },
    }),
  ]);
  if (calcularEstadoCuota(ultimoPago?.periodoHasta ?? null, hoy, config) === 'VENCIDO') {
    throw new ErrorApp(
      409,
      'CUOTA_VENCIDA',
      'Tu cuota está vencida: ponete al día en recepción para anotarte',
    );
  }

  const fechaClase = new Date(`${fecha}T00:00:00Z`);
  try {
    await prisma.$transaction(async (tx) => {
      // $queryRaw con template: el id viaja como parámetro, no pegado al SQL.
      await tx.$queryRaw`SELECT id FROM clases WHERE id = ${clase.id}::uuid FOR UPDATE`;
      const anotados = await tx.inscripcion.count({ where: { claseId, fecha: fechaClase } });
      if (anotados >= clase.cupo) {
        throw new ErrorApp(409, 'CLASE_LLENA', 'La clase está llena');
      }
      await tx.inscripcion.create({ data: { gimnasioId, claseId, socioId, fecha: fechaClase } });
    });
  } catch (error) {
    // El @@unique([claseId, fecha, socioId]) nos cuida del doble clic.
    if (esViolacionDeUnicidad(error)) {
      throw new ErrorApp(409, 'YA_ANOTADO', 'Ya estás anotado en esa clase');
    }
    throw error;
  }
}

/** Darse de baja de una clase que todavía no empezó (libera el lugar). */
export async function darseDeBaja(
  gimnasioId: string,
  socioId: string,
  claseId: string,
  fecha: string,
  ahora = new Date(),
): Promise<void> {
  const clase = await prisma.clase.findFirst({
    where: { id: claseId, gimnasioId },
    select: { horaInicio: true },
  });
  if (!clase) throw claseNoEncontrada();
  if (inicioDeClase(fecha, clase.horaInicio) <= ahora) {
    throw new ErrorApp(409, 'CLASE_EMPEZADA', 'La clase ya empezó: no te podés dar de baja');
  }
  const { count } = await prisma.inscripcion.deleteMany({
    where: { gimnasioId, claseId, socioId, fecha: new Date(`${fecha}T00:00:00Z`) },
  });
  if (count === 0) throw new ErrorApp(404, 'NO_ANOTADO', 'No estabas anotado en esa clase');
}
