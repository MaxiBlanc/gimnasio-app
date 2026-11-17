import type {
  DatosAnularPago,
  DatosRegistrarPago,
  Pago,
  VistaPreviaPago,
} from '@gimnasio/compartido';
import { prisma } from '../../db';
import { calcularMontos } from '../../dominio/montos';
import {
  fechaATexto,
  hoyEnArgentina,
  mesDeFecha,
  periodoDePago,
  primerMesAPagar,
  textoAMes,
} from '../../dominio/periodos';
import { ErrorApp } from '../../errores';
import type { Prisma } from '../../generated/prisma/client';
import { esViolacionDeExclusion } from '../../erroresBase';

const NOMBRES_MES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
const nombreMes = (fecha: Date) => {
  const { anio, mes } = mesDeFecha(fecha);
  return `${NOMBRES_MES[mes - 1]} ${anio}`;
};

const periodoYaPago = (fecha: Date) =>
  new ErrorApp(409, 'PERIODO_YA_PAGO', `El socio ya tiene pago ${nombreMes(fecha)}`);

// ───────────────────────────── Preparación del pago ─────────────────────────────

/**
 * Calcula TODO lo que implica cobrarle a un socio: qué meses cubre y cuánto paga.
 * Lo usan la vista previa (para mostrarlo antes de confirmar) y el registro (para guardarlo),
 * así las dos SIEMPRE coinciden.
 */
async function prepararPago(gimnasioId: string, socioId: string, desde?: string) {
  const socio = await prisma.socio.findFirst({
    where: { id: socioId, gimnasioId },
    select: {
      activo: true,
      plan: { select: { id: true, nombre: true, precio: true, duracionMeses: true, activo: true } },
      descuento: { select: { nombre: true, tipo: true, valor: true, activo: true } },
      // Solo el pago vigente que llega más lejos: de ahí sale hasta cuándo tiene pagado.
      pagos: {
        where: { anuladoEn: null },
        orderBy: { periodoHasta: 'desc' },
        take: 1,
        select: { periodoHasta: true },
      },
    },
  });
  if (!socio) throw new ErrorApp(404, 'SOCIO_NO_ENCONTRADO', 'No existe ese socio');
  if (!socio.activo) {
    throw new ErrorApp(
      409,
      'SOCIO_DADO_DE_BAJA',
      'El socio está dado de baja: reactivalo para cobrarle',
    );
  }
  if (!socio.plan.activo) {
    throw new ErrorApp(
      409,
      'PLAN_DESACTIVADO',
      `El plan "${socio.plan.nombre}" está desactivado: asignale otro plan al socio`,
    );
  }

  const mesDesde = desde
    ? textoAMes(desde)
    : primerMesAPagar(socio.pagos[0]?.periodoHasta ?? null, hoyEnArgentina());
  const periodo = periodoDePago(mesDesde, socio.plan.duracionMeses);

  // ¿Algún pago vigente se superpone con este período? Dos rangos se pisan si
  // cada uno empieza antes de que termine el otro.
  const superpuesto = await prisma.pago.findFirst({
    where: {
      socioId,
      anuladoEn: null,
      periodoDesde: { lte: periodo.periodoHasta },
      periodoHasta: { gte: periodo.periodoDesde },
    },
    orderBy: { periodoDesde: 'asc' },
    select: { periodoDesde: true, periodoHasta: true },
  });
  if (superpuesto) {
    // Informamos el primer mes en conflicto, no el inicio del pago existente.
    const conflicto =
      superpuesto.periodoDesde > periodo.periodoDesde
        ? superpuesto.periodoDesde
        : periodo.periodoDesde;
    throw periodoYaPago(conflicto);
  }

  // El descuento solo se aplica si sigue activo.
  const descuento = socio.descuento?.activo ? socio.descuento : null;
  const montos = calcularMontos(
    socio.plan.precio.toNumber(),
    descuento ? { tipo: descuento.tipo, valor: descuento.valor.toNumber() } : null,
  );

  return {
    plan: socio.plan,
    descuentoNombre: descuento?.nombre ?? null,
    ...periodo,
    ...montos,
  };
}

// ───────────────────────────── Casos de uso ─────────────────────────────

export async function vistaPreviaPago(
  gimnasioId: string,
  socioId: string,
  desde?: string,
): Promise<VistaPreviaPago> {
  const pago = await prepararPago(gimnasioId, socioId, desde);
  return {
    plan: { id: pago.plan.id, nombre: pago.plan.nombre, duracionMeses: pago.plan.duracionMeses },
    descuentoNombre: pago.descuentoNombre,
    periodoDesde: fechaATexto(pago.periodoDesde),
    periodoHasta: fechaATexto(pago.periodoHasta),
    montoBase: pago.montoBase,
    montoDescuento: pago.montoDescuento,
    montoFinal: pago.montoFinal,
  };
}

export async function registrarPago(
  gimnasioId: string,
  socioId: string,
  usuarioId: string,
  datos: DatosRegistrarPago,
): Promise<Pago> {
  const pago = await prepararPago(gimnasioId, socioId, datos.desde);

  try {
    const creado = await prisma.pago.create({
      data: {
        gimnasioId,
        socioId,
        planId: pago.plan.id,
        periodoDesde: pago.periodoDesde,
        periodoHasta: pago.periodoHasta,
        montoBase: pago.montoBase,
        montoDescuento: pago.montoDescuento,
        montoFinal: pago.montoFinal,
        descuentoNombre: pago.descuentoNombre,
        formaPago: datos.formaPago,
        registradoPorId: usuarioId,
      },
      select: seleccionPago,
    });
    return aPago(creado);
  } catch (error) {
    // Si dos recepcionistas cobran el mismo mes al mismo tiempo, los dos pasan el chequeo
    // de arriba, pero la restricción EXCLUDE de la base frena al segundo. Lo traducimos a 409.
    if (esViolacionDeExclusion(error)) throw periodoYaPago(pago.periodoDesde);
    throw error;
  }
}

/** Historial completo del socio, incluidos los anulados, del más reciente al más viejo. */
export async function listarPagosDeSocio(gimnasioId: string, socioId: string): Promise<Pago[]> {
  const socio = await prisma.socio.findFirst({
    where: { id: socioId, gimnasioId },
    select: { id: true },
  });
  if (!socio) throw new ErrorApp(404, 'SOCIO_NO_ENCONTRADO', 'No existe ese socio');

  const pagos = await prisma.pago.findMany({
    where: { socioId, gimnasioId },
    select: seleccionPago,
    orderBy: [{ periodoDesde: 'desc' }, { creadoEn: 'desc' }],
  });
  return pagos.map(aPago);
}

/**
 * Anular un pago mal cargado. No se borra: queda registrado quién, cuándo y por qué.
 * Una vez anulado, ese mes queda libre para registrar el pago correcto.
 */
export async function anularPago(
  gimnasioId: string,
  pagoId: string,
  usuarioId: string,
  datos: DatosAnularPago,
): Promise<Pago> {
  const pago = await prisma.pago.findFirst({
    where: { id: pagoId, gimnasioId },
    select: { anuladoEn: true },
  });
  if (!pago) throw new ErrorApp(404, 'PAGO_NO_ENCONTRADO', 'No existe ese pago');

  // Condición "todavía no anulado" en el mismo UPDATE: si dos personas anulan a la vez,
  // solo una lo logra.
  const { count } = await prisma.pago.updateMany({
    where: { id: pagoId, anuladoEn: null },
    data: { anuladoEn: new Date(), anuladoPorId: usuarioId, motivoAnulacion: datos.motivo },
  });
  if (count !== 1) throw new ErrorApp(409, 'PAGO_YA_ANULADO', 'Ese pago ya estaba anulado');

  return aPago(
    await prisma.pago.findUniqueOrThrow({ where: { id: pagoId }, select: seleccionPago }),
  );
}

// ───────────────────────────── Conversión ─────────────────────────────

const seleccionPago = {
  id: true,
  periodoDesde: true,
  periodoHasta: true,
  montoBase: true,
  montoDescuento: true,
  montoFinal: true,
  descuentoNombre: true,
  formaPago: true,
  creadoEn: true,
  anuladoEn: true,
  motivoAnulacion: true,
  plan: { select: { id: true, nombre: true } },
  registradoPor: { select: { nombre: true } },
  anuladoPor: { select: { nombre: true } },
} satisfies Prisma.PagoSelect;

function aPago(pago: Prisma.PagoGetPayload<{ select: typeof seleccionPago }>): Pago {
  return {
    id: pago.id,
    periodoDesde: fechaATexto(pago.periodoDesde),
    periodoHasta: fechaATexto(pago.periodoHasta),
    montoBase: pago.montoBase.toNumber(),
    montoDescuento: pago.montoDescuento.toNumber(),
    montoFinal: pago.montoFinal.toNumber(),
    descuentoNombre: pago.descuentoNombre,
    formaPago: pago.formaPago,
    plan: pago.plan,
    registradoPor: pago.registradoPor,
    creadoEn: pago.creadoEn.toISOString(),
    anulacion:
      pago.anuladoEn && pago.anuladoPor
        ? {
            fecha: pago.anuladoEn.toISOString(),
            motivo: pago.motivoAnulacion ?? '',
            por: pago.anuladoPor,
          }
        : null,
  };
}
