import {
  ESTADOS_CUOTA,
  normalizarTexto,
  type DatosCrearSocio,
  type DatosEditarSocio,
  type EstadoCuota,
  type FiltrosSocios,
  type Pagina,
  type RespuestaAltaSocio,
  type ResumenCuotas,
  type Socio,
} from '@gimnasio/compartido';
import { prisma } from '../../db';
import { calcularEstadoCuota, limitesDeHoy, type ConfigCuotas } from '../../dominio/estadoCuota';
import { fechaATexto, hoyEnArgentina } from '../../dominio/periodos';
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
  // El pago vigente que llega más lejos: su `periodoHasta` es el vencimiento del socio.
  pagos: {
    where: { anuladoEn: null },
    orderBy: { periodoHasta: 'desc' },
    take: 1,
    select: { periodoHasta: true },
  },
} satisfies Prisma.SocioSelect;

type SocioDeBase = Prisma.SocioGetPayload<{ select: typeof seleccionSocio }>;

/** Lo necesario para calcular estados de cuota: la fecha de hoy y la config del gimnasio. */
export interface ContextoCuotas {
  hoy: Date;
  config: ConfigCuotas;
}

export async function obtenerContextoCuotas(gimnasioId: string): Promise<ContextoCuotas> {
  const config = await prisma.gimnasio.findUniqueOrThrow({
    where: { id: gimnasioId },
    select: { diaCierreCobro: true, diasAvisoVencimiento: true },
  });
  return { hoy: hoyEnArgentina(), config };
}

/** Nunca devolvemos el hash: solo si la cuenta está activada o no. */
function aSocio(
  { hashContrasena, creadoEn, pagos, ...socio }: SocioDeBase,
  { hoy, config }: ContextoCuotas,
): Socio {
  const vencimiento = pagos[0]?.periodoHasta ?? null;
  return {
    ...socio,
    cuentaActivada: hashContrasena !== null,
    creadoEn: creadoEn.toISOString(),
    cuota: {
      estado: calcularEstadoCuota(vencimiento, hoy, config),
      vencimiento: vencimiento ? fechaATexto(vencimiento) : null,
    },
  };
}

/**
 * Traduce un estado de cuota a una condición de base de datos, para FILTRAR el listado
 * (ej. "solo vencidos") sin traer todos los socios a memoria.
 * Usa las mismas reglas que calcularEstadoCuota (vía limitesDeHoy), y un test verifica
 * que ambas coincidan socio por socio.
 */
export function filtroEstado(estado: EstadoCuota | undefined, { hoy, config }: ContextoCuotas) {
  if (!estado) return {};
  const { finMesActual, enPeriodoDeAviso, pasoElCierre } = limitesDeHoy(hoy, config);

  const pagoVigente = (periodoHasta: Prisma.DateTimeFilter) => ({
    anuladoEn: null,
    periodoHasta,
  });
  const pagoEsteMes = { pagos: { some: pagoVigente({ gte: finMesActual }) } };
  const sinPagoEsteMes = { pagos: { none: pagoVigente({ gte: finMesActual }) } };
  const pagoElSiguiente = { pagos: { some: pagoVigente({ gt: finMesActual }) } };
  const sinPagoElSiguiente = { pagos: { none: pagoVigente({ gt: finMesActual }) } };
  const ninguno = { id: { in: [] } }; // condición que nunca se cumple

  const filtros: Record<EstadoCuota, Prisma.SocioWhereInput> = {
    AL_DIA: enPeriodoDeAviso ? pagoElSiguiente : pagoEsteMes,
    POR_VENCER: enPeriodoDeAviso ? { AND: [pagoEsteMes, sinPagoElSiguiente] } : ninguno,
    PENDIENTE: pasoElCierre ? ninguno : sinPagoEsteMes,
    VENCIDO: pasoElCierre ? sinPagoEsteMes : ninguno,
  };
  return filtros[estado];
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
  const contexto = await obtenerContextoCuotas(gimnasioId);
  const where: Prisma.SocioWhereInput = {
    gimnasioId,
    activo: filtros.incluirBajas ? undefined : true,
    AND: [...filtroBusqueda(filtros.busqueda), filtroEstado(filtros.estado, contexto)],
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

  return {
    datos: socios.map((socio) => aSocio(socio, contexto)),
    total,
    pagina: filtros.pagina,
    porPagina: filtros.porPagina,
  };
}

/**
 * Cuántos socios ACTIVOS hay en cada estado. Son 4 COUNT que corren en paralelo
 * en la base, sin traer ningún socio a memoria.
 */
export async function resumenCuotas(gimnasioId: string): Promise<ResumenCuotas> {
  const contexto = await obtenerContextoCuotas(gimnasioId);
  const cantidades = await prisma.$transaction(
    ESTADOS_CUOTA.map((estado) =>
      prisma.socio.count({
        where: { gimnasioId, activo: true, ...filtroEstado(estado, contexto) },
      }),
    ),
  );
  // Object.fromEntries arma { AL_DIA: n, POR_VENCER: n, ... } a partir de pares [clave, valor].
  return Object.fromEntries(
    ESTADOS_CUOTA.map((estado, i) => [estado, cantidades[i] ?? 0]),
  ) as ResumenCuotas;
}

export async function obtenerSocio(gimnasioId: string, id: string): Promise<Socio> {
  const socio = await prisma.socio.findFirst({ where: { id, gimnasioId }, select: seleccionSocio });
  if (!socio) throw socioNoEncontrado();
  return aSocio(socio, await obtenerContextoCuotas(gimnasioId));
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
  return { socio: aSocio(socio, await obtenerContextoCuotas(gimnasioId)), correoEnviado };
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

  return aSocio(socio, await obtenerContextoCuotas(gimnasioId));
}
