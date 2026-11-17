import {
  problemaValorDescuento,
  type DatosCrearDescuento,
  type DatosEditarDescuento,
  type Descuento,
} from '@gimnasio/compartido';
import { prisma } from '../../db';
import { ErrorApp } from '../../errores';
import type { Prisma } from '../../generated/prisma/client';

const seleccionDescuento = {
  id: true,
  nombre: true,
  tipo: true,
  valor: true,
  activo: true,
  _count: { select: { socios: true } },
} satisfies Prisma.DescuentoSelect;

function aDescuento({
  _count,
  valor,
  ...descuento
}: Prisma.DescuentoGetPayload<{ select: typeof seleccionDescuento }>): Descuento {
  return { ...descuento, valor: valor.toNumber(), cantidadSocios: _count.socios };
}

async function buscarDescuentoDelGimnasio(gimnasioId: string, id: string) {
  const descuento = await prisma.descuento.findFirst({
    where: { id, gimnasioId },
    select: { id: true, tipo: true, valor: true },
  });
  if (!descuento) throw new ErrorApp(404, 'DESCUENTO_NO_ENCONTRADO', 'No existe ese descuento');
  return descuento;
}

async function verificarNombreLibre(gimnasioId: string, nombre: string, excepto?: string) {
  const repetido = await prisma.descuento.findFirst({
    where: {
      gimnasioId,
      nombre: { equals: nombre, mode: 'insensitive' },
      id: excepto ? { not: excepto } : undefined,
    },
    select: { id: true },
  });
  if (repetido) {
    throw new ErrorApp(409, 'NOMBRE_EN_USO', `Ya existe un descuento llamado "${nombre}"`);
  }
}

export async function listarDescuentos(gimnasioId: string): Promise<Descuento[]> {
  const descuentos = await prisma.descuento.findMany({
    where: { gimnasioId },
    select: seleccionDescuento,
    orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
  });
  return descuentos.map(aDescuento);
}

export async function crearDescuento(
  gimnasioId: string,
  datos: DatosCrearDescuento,
): Promise<Descuento> {
  await verificarNombreLibre(gimnasioId, datos.nombre);
  const descuento = await prisma.descuento.create({
    data: { ...datos, gimnasioId },
    select: seleccionDescuento,
  });
  return aDescuento(descuento);
}

export async function editarDescuento(
  gimnasioId: string,
  id: string,
  datos: DatosEditarDescuento,
): Promise<Descuento> {
  const actual = await buscarDescuentoDelGimnasio(gimnasioId, id);
  if (datos.nombre) await verificarNombreLibre(gimnasioId, datos.nombre, id);

  // Si cambia solo el tipo o solo el valor, validamos la combinación con lo que ya está guardado.
  // Ej.: pasar un "MONTO_FIJO de 5000" a PORCENTAJE sin cambiar el valor daría 5000 %.
  const problema = problemaValorDescuento(
    datos.tipo ?? actual.tipo,
    datos.valor ?? actual.valor.toNumber(),
  );
  if (problema) throw new ErrorApp(400, 'VALOR_INVALIDO', problema);

  const descuento = await prisma.descuento.update({
    where: { id },
    data: datos,
    select: seleccionDescuento,
  });
  return aDescuento(descuento);
}
