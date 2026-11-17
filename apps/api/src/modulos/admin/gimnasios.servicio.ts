import bcrypt from 'bcryptjs';
import type {
  DatosCrearGimnasio,
  DatosEditarGimnasio,
  GimnasioAdmin,
  GimnasioAdminDetalle,
} from '@gimnasio/compartido';
import { prisma } from '../../db';
import { ErrorApp } from '../../errores';
import type { Prisma } from '../../generated/prisma/client';
import { Rol } from '../../generated/prisma/enums';

/**
 * Casos de uso del súper-admin sobre los gimnasios.
 * Es el ÚNICO módulo que trabaja con varios gimnasios a la vez; por eso sus rutas
 * están protegidas con permitirRoles('SUPERADMIN').
 */

const seleccionGimnasio = {
  id: true,
  nombre: true,
  slug: true,
  logoUrl: true,
  colorPrimario: true,
  colorSecundario: true,
  activo: true,
  creadoEn: true,
  // _count: Prisma cuenta los registros relacionados con un COUNT en SQL, sin traerlos.
  _count: { select: { socios: true, usuarios: true } },
} satisfies Prisma.GimnasioSelect;

type GimnasioConConteo = Prisma.GimnasioGetPayload<{ select: typeof seleccionGimnasio }>;

function aGimnasioAdmin({ _count, creadoEn, ...gimnasio }: GimnasioConConteo): GimnasioAdmin {
  return {
    ...gimnasio,
    creadoEn: creadoEn.toISOString(),
    cantidadSocios: _count.socios,
    cantidadUsuarios: _count.usuarios,
  };
}

const gimnasioNoEncontrado = () =>
  new ErrorApp(404, 'GIMNASIO_NO_ENCONTRADO', 'No existe ese gimnasio');

export async function listarGimnasios(): Promise<GimnasioAdmin[]> {
  const gimnasios = await prisma.gimnasio.findMany({
    select: seleccionGimnasio,
    orderBy: { nombre: 'asc' },
  });
  return gimnasios.map(aGimnasioAdmin);
}

export async function obtenerGimnasio(id: string): Promise<GimnasioAdminDetalle> {
  const gimnasio = await prisma.gimnasio.findUnique({
    where: { id },
    select: {
      ...seleccionGimnasio,
      usuarios: {
        select: { id: true, nombre: true, email: true, rol: true, activo: true },
        orderBy: [{ rol: 'asc' }, { nombre: 'asc' }],
      },
    },
  });
  if (!gimnasio) throw gimnasioNoEncontrado();
  const { usuarios, ...resto } = gimnasio;
  return { ...aGimnasioAdmin(resto), usuarios };
}

/**
 * Crea el gimnasio y su dueño en una TRANSACCIÓN: o se crean los dos, o ninguno.
 * Sin transacción, si fallara la creación del dueño quedaría un gimnasio sin nadie que lo maneje.
 */
export async function crearGimnasio(datos: DatosCrearGimnasio): Promise<GimnasioAdminDetalle> {
  const existente = await prisma.gimnasio.findUnique({ where: { slug: datos.gimnasio.slug } });
  if (existente) {
    throw new ErrorApp(
      409,
      'SLUG_EN_USO',
      `Ya existe un gimnasio con la dirección "${datos.gimnasio.slug}"`,
    );
  }

  const hashContrasena = await bcrypt.hash(datos.dueno.contrasena, 10);

  const gimnasio = await prisma.$transaction(async (tx) => {
    const nuevo = await tx.gimnasio.create({ data: datos.gimnasio });
    await tx.usuario.create({
      data: {
        gimnasioId: nuevo.id,
        nombre: datos.dueno.nombre,
        email: datos.dueno.email,
        hashContrasena,
        rol: Rol.DUENO,
      },
    });
    return nuevo;
  });

  return obtenerGimnasio(gimnasio.id);
}

/**
 * Edita datos del gimnasio. Si se lo SUSPENDE (activo: false), además se cierran todas las
 * sesiones de su personal, para que nadie siga usando el sistema hasta que venza su token.
 */
export async function editarGimnasio(
  id: string,
  datos: DatosEditarGimnasio,
): Promise<GimnasioAdminDetalle> {
  const existe = await prisma.gimnasio.findUnique({ where: { id }, select: { id: true } });
  if (!existe) throw gimnasioNoEncontrado();

  await prisma.$transaction(async (tx) => {
    await tx.gimnasio.update({ where: { id }, data: datos });
    if (datos.activo === false) {
      await tx.sesion.updateMany({
        where: {
          revocadaEn: null,
          OR: [{ usuario: { gimnasioId: id } }, { socio: { gimnasioId: id } }],
        },
        data: { revocadaEn: new Date() },
      });
    }
  });

  return obtenerGimnasio(id);
}
