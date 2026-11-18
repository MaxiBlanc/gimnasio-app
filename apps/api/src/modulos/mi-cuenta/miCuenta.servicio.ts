import type { MiCuenta } from '@gimnasio/compartido';
import { prisma } from '../../db';
import { calcularEstadoCuota } from '../../dominio/estadoCuota';
import { fechaATexto, inicioDeMes, mesDeFecha } from '../../dominio/periodos';
import { ErrorApp } from '../../errores';
import { obtenerContextoCuotas } from '../socios/socios.servicio';

/** Argentina está en UTC-3 todo el año (no usa horario de verano). */
const DESFASE_ARGENTINA_MS = 3 * 60 * 60 * 1000;

/** Cuántos pagos mostrarle al socio (alcanza para ver el último año). */
const PAGOS_A_MOSTRAR = 12;

/** Lo que ve el socio desde su celular: su cuota, su plan y sus pagos. */
export async function obtenerMiCuenta(gimnasioId: string, socioId: string): Promise<MiCuenta> {
  const { hoy, config } = await obtenerContextoCuotas(gimnasioId);
  // 00:00 del día 1 en Argentina = 03:00 UTC.
  const inicioMes = new Date(inicioDeMes(mesDeFecha(hoy)).getTime() + DESFASE_ARGENTINA_MS);

  const socio = await prisma.socio.findFirst({
    where: { id: socioId, gimnasioId, activo: true },
    select: {
      nombre: true,
      apellido: true,
      dni: true,
      email: true,
      plan: { select: { nombre: true, precio: true, duracionMeses: true } },
      descuento: { select: { nombre: true } },
      pagos: {
        where: { anuladoEn: null },
        orderBy: { periodoHasta: 'desc' },
        take: PAGOS_A_MOSTRAR,
        select: {
          id: true,
          periodoDesde: true,
          periodoHasta: true,
          montoFinal: true,
          formaPago: true,
          creadoEn: true,
        },
      },
      _count: { select: { ingresos: { where: { creadoEn: { gte: inicioMes } } } } },
    },
  });
  if (!socio) throw new ErrorApp(404, 'SOCIO_NO_ENCONTRADO', 'No encontramos tu cuenta');

  const vencimiento = socio.pagos[0]?.periodoHasta ?? null;
  return {
    nombre: socio.nombre,
    apellido: socio.apellido,
    dni: socio.dni,
    email: socio.email,
    plan: { ...socio.plan, precio: socio.plan.precio.toNumber() },
    descuento: socio.descuento?.nombre ?? null,
    cuota: {
      estado: calcularEstadoCuota(vencimiento, hoy, config),
      vencimiento: vencimiento ? fechaATexto(vencimiento) : null,
    },
    pagos: socio.pagos.map((pago) => ({
      id: pago.id,
      periodoDesde: fechaATexto(pago.periodoDesde),
      periodoHasta: fechaATexto(pago.periodoHasta),
      montoFinal: pago.montoFinal.toNumber(),
      formaPago: pago.formaPago,
      fecha: pago.creadoEn.toISOString(),
    })),
    ingresosDelMes: socio._count.ingresos,
  };
}
