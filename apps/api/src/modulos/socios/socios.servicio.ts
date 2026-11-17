import {
  normalizarTexto,
  type DatosCrearSocio,
  type DatosEditarSocio,
  type FiltrosSocios,
  type Pagina,
  type RespuestaAltaSocio,
  type Socio,
} from '@gimnasio/compartido';
import { prisma } from '../../db';
import { ErrorApp } from '../../errores';
import type { Prisma } from '../../generated/prisma/client';
import { enviarActivacion } from './activacion.servicio';

const seleccionSocio = {
  id: true,
  nombre: true,
  apellido: true,
  dni: true,
  telefono: true,
  email: true,
  emergenciaNombre: true,
  emergenciaTelefono: true,
  activo: true,
  hashContrasena: true,
  creadoEn: true,
  plan: { select: { id: true, nombre: true } },
  descuento: { select: { id: true, nombre: true } },
} satisfies Prisma.SocioSelect;

type SocioDeBase = Prisma.SocioGetPayload<{ select: typeof seleccionSocio }>;

/** Nunca devolvemos el hash: solo si la cuenta está activada o no. */
function aSocio({ hashContrasena, creadoEn, ...socio }: SocioDeBase): Socio {
  return { ...socio, cuentaActivada: hashContrasena !== null, creadoEn: creadoEn.toISOString() };
}

const socioNoEncontrado = () => new ErrorApp(404, 'SOCIO_NO_ENCONTRADO', 'No existe ese socio');

// ───────────────────────────── Validaciones ─────────────────────────────

/**
 * El plan y el descuento tienen que ser DEL MISMO gimnasio y estar activos.
 * La clave foránea compuesta ya impide asignar uno de otro gimnasio, pero acá damos
 * un error claro (400) en vez de dejar que explote la base (500).
 */
async function validarPlanYDescuento(
  gimnasioId: string,
  datos: { planId?: string; descuentoId?: string | null },
) {
  if (datos.planId) {
    const plan = await prisma.plan.findFirst({
      where: { id: datos.planId, gimnasioId, activo: true },
      select: { id: true },
    });
    if (!plan)
      throw new ErrorApp(400, 'PLAN_INVALIDO', 'El plan elegido no existe o está desactivado');
  }
  if (datos.descuentoId) {
    const descuento = await prisma.descuento.findFirst({
      where: { id: datos.descuentoId, gimnasioId, activo: true },
      select: { id: true },
    });
    if (!descuento) {
      throw new ErrorApp(
        400,
        'DESCUENTO_INVALIDO',
        'El descuento elegido no existe o está desactivado',
      );
    }
  }
}

async function verificarDniLibre(gimnasioId: string, dni: string, excepto?: string) {
  const repetido = await prisma.socio.findFirst({
    where: { gimnasioId, dni, id: excepto ? { not: excepto } : undefined },
    select: { nombre: true, apellido: true },
  });
  if (repetido) {
    throw new ErrorApp(
      409,
      'DNI_EN_USO',
      `El DNI ${dni} ya está registrado (${repetido.nombre} ${repetido.apellido})`,
    );
  }
}

// ───────────────────────────── Casos de uso ─────────────────────────────

/** Arma la columna de búsqueda. Exportada para que el seed la use igual que la API. */
export function textoBusquedaSocio(socio: { nombre: string; apellido: string; dni: string }) {
  return normalizarTexto(`${socio.nombre} ${socio.apellido} ${socio.dni}`);
}

/**
 * Búsqueda por palabras sobre la columna normalizada: "juan lop" encuentra a "Juana López".
 * Cada palabra tiene que aparecer (AND), en cualquier orden y sin importar acentos ni mayúsculas.
 */
function filtroBusqueda(busqueda: string | undefined): Prisma.SocioWhereInput[] {
  if (!busqueda) return [];
  return normalizarTexto(busqueda)
    .replaceAll('.', '') // "30.111" → "30111", para buscar DNI con puntos
    .split(/\s+/)
    .filter(Boolean)
    .map((palabra) => ({ textoBusqueda: { contains: palabra } }));
}

export async function listarSocios(
  gimnasioId: string,
  filtros: FiltrosSocios,
): Promise<Pagina<Socio>> {
  const where: Prisma.SocioWhereInput = {
    gimnasioId,
    activo: filtros.incluirBajas ? undefined : true,
    AND: filtroBusqueda(filtros.busqueda),
  };

  // Las dos consultas son independientes: las mandamos juntas en una transacción.
  const [socios, total] = await prisma.$transaction([
    prisma.socio.findMany({
      where,
      select: seleccionSocio,
      orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
      skip: (filtros.pagina - 1) * filtros.porPagina,
      take: filtros.porPagina,
    }),
    prisma.socio.count({ where }),
  ]);

  return { datos: socios.map(aSocio), total, pagina: filtros.pagina, porPagina: filtros.porPagina };
}

export async function obtenerSocio(gimnasioId: string, id: string): Promise<Socio> {
  const socio = await prisma.socio.findFirst({ where: { id, gimnasioId }, select: seleccionSocio });
  if (!socio) throw socioNoEncontrado();
  return aSocio(socio);
}

/**
 * Alta de socio + mail de activación.
 * Si el mail falla, el socio queda creado igual (no perdemos la carga de la recepcionista)
 * y se informa `correoEnviado: false` para que puedan reenviarlo.
 */
export async function crearSocio(
  gimnasioId: string,
  datos: DatosCrearSocio,
): Promise<RespuestaAltaSocio> {
  await validarPlanYDescuento(gimnasioId, datos);
  await verificarDniLibre(gimnasioId, datos.dni);

  const socio = await prisma.socio.create({
    data: { ...datos, gimnasioId, textoBusqueda: textoBusquedaSocio(datos) },
    select: seleccionSocio,
  });

  const correoEnviado = await enviarActivacion(gimnasioId, socio.id);
  return { socio: aSocio(socio), correoEnviado };
}

export async function editarSocio(
  gimnasioId: string,
  id: string,
  datos: DatosEditarSocio,
): Promise<Socio> {
  const actual = await prisma.socio.findFirst({
    where: { id, gimnasioId },
    select: { nombre: true, apellido: true, dni: true },
  });
  if (!actual) throw socioNoEncontrado();

  await validarPlanYDescuento(gimnasioId, datos);
  if (datos.dni) await verificarDniLibre(gimnasioId, datos.dni, id);

  // Recalculamos la búsqueda combinando lo nuevo con lo que ya estaba guardado.
  const textoBusqueda = textoBusquedaSocio({ ...actual, ...datos });

  const socio = await prisma.$transaction(async (tx) => {
    const actualizado = await tx.socio.update({
      where: { id },
      data: { ...datos, textoBusqueda },
      select: seleccionSocio,
    });
    // Dar de baja a un socio cierra sus sesiones abiertas en el celular.
    if (datos.activo === false) {
      await tx.sesion.updateMany({
        where: { socioId: id, revocadaEn: null },
        data: { revocadaEn: new Date() },
      });
    }
    return actualizado;
  });

  return aSocio(socio);
}
