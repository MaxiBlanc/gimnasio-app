import type { DatosCrearPlan, DatosEditarPlan, Plan } from '@gimnasio/compartido';
import { prisma } from '../../db';
import { ErrorApp } from '../../errores';
import type { Prisma } from '../../generated/prisma/client';

/**
 * Regla de oro del multi-gimnasio: TODAS las funciones reciben `gimnasioId` como primer
 * parámetro y lo usan en el `where`. El id de un plan solo no alcanza: tiene que ser
 * un plan de ESE gimnasio.
 */

const seleccionPlan = {
  id: true,
  nombre: true,
  precio: true,
  duracionMeses: true,
  activo: true,
  _count: { select: { socios: true } },
} satisfies Prisma.PlanSelect;

function aPlan({
  _count,
  precio,
  ...plan
}: Prisma.PlanGetPayload<{ select: typeof seleccionPlan }>): Plan {
  // Prisma devuelve DECIMAL como objeto Decimal (para no perder precisión). Lo pasamos a number
  // solo para enviarlo; los cálculos de plata se hacen en el backend.
  return { ...plan, precio: precio.toNumber(), cantidadSocios: _count.socios };
}

/**
 * Busca un plan DENTRO del gimnasio. Si el plan existe pero es de otro gimnasio,
 * responde 404 igual que si no existiera: no le confirmamos a nadie que ese id existe.
 */
async function verificarPlanDelGimnasio(gimnasioId: string, id: string) {
  const plan = await prisma.plan.findFirst({ where: { id, gimnasioId }, select: { id: true } });
  if (!plan) throw new ErrorApp(404, 'PLAN_NO_ENCONTRADO', 'No existe ese plan');
}

async function verificarNombreLibre(gimnasioId: string, nombre: string, excepto?: string) {
  const repetido = await prisma.plan.findFirst({
    where: {
      gimnasioId,
      nombre: { equals: nombre, mode: 'insensitive' }, // "mensual" choca con "Mensual"
      id: excepto ? { not: excepto } : undefined,
    },
    select: { id: true },
  });
  if (repetido) throw new ErrorApp(409, 'NOMBRE_EN_USO', `Ya existe un plan llamado "${nombre}"`);
}

/** Activos primero y después por nombre: así la lista de un formulario queda ordenada. */
export async function listarPlanes(gimnasioId: string): Promise<Plan[]> {
  const planes = await prisma.plan.findMany({
    where: { gimnasioId },
    select: seleccionPlan,
    orderBy: [{ activo: 'desc' }, { duracionMeses: 'asc' }, { nombre: 'asc' }],
  });
  return planes.map(aPlan);
}

export async function crearPlan(gimnasioId: string, datos: DatosCrearPlan): Promise<Plan> {
  await verificarNombreLibre(gimnasioId, datos.nombre);
  const plan = await prisma.plan.create({
    data: { ...datos, gimnasioId },
    select: seleccionPlan,
  });
  return aPlan(plan);
}

/**
 * Cambiar el precio NO toca los pagos ya registrados (guardan su propio monto):
 * el precio nuevo se aplica desde el próximo pago de cada socio.
 * Los planes no se borran (tienen socios y pagos asociados): se desactivan.
 */
export async function editarPlan(
  gimnasioId: string,
  id: string,
  datos: DatosEditarPlan,
): Promise<Plan> {
  await verificarPlanDelGimnasio(gimnasioId, id);
  if (datos.nombre) await verificarNombreLibre(gimnasioId, datos.nombre, id);

  const plan = await prisma.plan.update({ where: { id }, data: datos, select: seleccionPlan });
  return aPlan(plan);
}
