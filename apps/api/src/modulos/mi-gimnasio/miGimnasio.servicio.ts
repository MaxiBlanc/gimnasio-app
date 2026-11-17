import type { ConfiguracionGimnasio, DatosConfiguracionGimnasio } from '@gimnasio/compartido';
import { prisma } from '../../db';
import type { Prisma } from '../../generated/prisma/client';

/**
 * Configuración del gimnasio del usuario logueado.
 * A diferencia del panel del súper-admin, acá NUNCA se recibe el id del gimnasio:
 * siempre es el del token. Así un dueño solo puede tocar el suyo.
 */

const seleccionConfiguracion = {
  id: true,
  nombre: true,
  slug: true,
  logoUrl: true,
  colorPrimario: true,
  colorSecundario: true,
  diaCierreCobro: true,
  diasAvisoVencimiento: true,
  minutosPermanencia: true,
  capacidadMaxima: true,
} satisfies Prisma.GimnasioSelect;

export async function obtenerConfiguracion(gimnasioId: string): Promise<ConfiguracionGimnasio> {
  return prisma.gimnasio.findUniqueOrThrow({
    where: { id: gimnasioId },
    select: seleccionConfiguracion,
  });
}

export async function editarConfiguracion(
  gimnasioId: string,
  datos: DatosConfiguracionGimnasio,
): Promise<ConfiguracionGimnasio> {
  return prisma.gimnasio.update({
    where: { id: gimnasioId },
    data: datos,
    select: seleccionConfiguracion,
  });
}
