import bcrypt from 'bcryptjs';
import type { DatosCrearPersonal, DatosEditarPersonal, Personal } from '@gimnasio/compartido';
import { prisma } from '../../db';
import { ErrorApp } from '../../errores';
import { Rol } from '../../generated/prisma/enums';

const seleccion = { id: true, nombre: true, email: true, roles: true, activo: true } as const;

/** El dueño se ve en la lista (para saber quién es quién) pero no se toca desde acá. */
function aPersonal(usuario: {
  id: string;
  nombre: string;
  email: string;
  roles: Rol[];
  activo: boolean;
}): Personal {
  return { ...usuario, editable: !usuario.roles.includes(Rol.DUENO) };
}

const noEncontrado = () => new ErrorApp(404, 'NO_ENCONTRADO', 'No encontramos a esa persona');

async function verificarEmailLibre(gimnasioId: string, email: string, excepto?: string) {
  const repetido = await prisma.usuario.findFirst({
    where: { gimnasioId, email, id: excepto ? { not: excepto } : undefined },
    select: { id: true },
  });
  if (repetido)
    throw new ErrorApp(409, 'EMAIL_EN_USO', `Ya hay alguien del personal con el email ${email}`);
}

/** Activos primero, después por nombre. */
export async function listarPersonal(gimnasioId: string): Promise<Personal[]> {
  const usuarios = await prisma.usuario.findMany({
    where: { gimnasioId },
    select: seleccion,
    orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
  });
  return usuarios.map(aPersonal);
}

export async function crearPersonal(
  gimnasioId: string,
  datos: DatosCrearPersonal,
): Promise<Personal> {
  await verificarEmailLibre(gimnasioId, datos.email);
  const usuario = await prisma.usuario.create({
    data: {
      gimnasioId,
      nombre: datos.nombre,
      email: datos.email,
      roles: datos.roles,
      hashContrasena: await bcrypt.hash(datos.contrasena, 10),
    },
    select: seleccion,
  });
  return aPersonal(usuario);
}

/**
 * Si se le cambian los roles, se lo desactiva o se le cambia la contraseña, se cierran sus
 * sesiones: así no sigue entrando con lo que tenía antes. (El token de acceso que ya tiene
 * dura a lo sumo 15 minutos y no se puede renovar.)
 */
export async function editarPersonal(
  gimnasioId: string,
  id: string,
  datos: DatosEditarPersonal,
): Promise<Personal> {
  const actual = await prisma.usuario.findFirst({ where: { id, gimnasioId }, select: seleccion });
  if (!actual) throw noEncontrado();
  if (actual.roles.includes(Rol.DUENO)) {
    throw new ErrorApp(403, 'SIN_PERMISO', 'Los datos del dueño no se cambian desde acá');
  }
  await verificarEmailLibre(gimnasioId, datos.email, id);

  const cambiaContrasena = Boolean(datos.contrasena);
  const cambiaRoles =
    actual.roles.length !== datos.roles.length ||
    actual.roles.some((rol) => !(datos.roles as Rol[]).includes(rol));
  const cerrarSesiones = cambiaContrasena || cambiaRoles || !datos.activo;

  // El hash es lento (a propósito): lo calculamos antes de abrir la transacción.
  const hashContrasena = datos.contrasena ? await bcrypt.hash(datos.contrasena, 10) : undefined;

  return prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.update({
      where: { id },
      data: {
        nombre: datos.nombre,
        email: datos.email,
        roles: datos.roles,
        activo: datos.activo,
        hashContrasena,
      },
      select: seleccion,
    });
    if (cerrarSesiones) {
      await tx.sesion.updateMany({
        where: { usuarioId: id, revocadaEn: null },
        data: { revocadaEn: new Date() },
      });
    }
    return aPersonal(usuario);
  });
}
