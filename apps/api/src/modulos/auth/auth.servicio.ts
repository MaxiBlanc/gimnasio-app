import bcrypt from 'bcryptjs';
import type {
  DatosLoginAdmin,
  DatosLoginSocio,
  DatosLoginStaff,
  GimnasioSesion,
  UsuarioSesion,
} from '@gimnasio/compartido';
import { prisma } from '../../db';
import { ErrorApp } from '../../errores';
import type { Prisma } from '../../generated/prisma/client';
import { Rol } from '../../generated/prisma/enums';
import {
  type DatosAuth,
  firmarTokenAcceso,
  generarTokenAleatorio,
  hashearToken,
  vencimientoTokenRefresco,
} from './tokens';

/** Resultado interno de un login: el token de refresco NO va en el JSON, va en una cookie. */
export interface SesionIniciada {
  tokenAcceso: string;
  tokenRefresco: string;
  usuario: UsuarioSesion;
}

const credencialesInvalidas = () =>
  new ErrorApp(401, 'CREDENCIALES_INVALIDAS', 'Email o contraseña incorrectos');

const sesionInvalida = () =>
  new ErrorApp(401, 'SESION_INVALIDA', 'La sesión expiró. Volvé a iniciar sesión.');

/**
 * Hash de una contraseña cualquiera. Si el email no existe, igual comparamos contra este hash,
 * así la respuesta tarda lo mismo que con un email válido. Si no, midiendo el tiempo de
 * respuesta se podría averiguar qué emails están registrados.
 */
const HASH_FALSO = bcrypt.hashSync('contrasena-que-no-existe', 10);

/** Campos del usuario que traemos de la base (con su gimnasio) para armar la sesión. */
const seleccionUsuario = {
  id: true,
  nombre: true,
  email: true,
  rol: true,
  activo: true,
  hashContrasena: true,
  gimnasio: {
    select: {
      id: true,
      nombre: true,
      slug: true,
      logoUrl: true,
      colorPrimario: true,
      colorSecundario: true,
      activo: true,
    },
  },
} satisfies Prisma.UsuarioSelect; // `satisfies`: valida la forma sin perder el tipo exacto.

/** Tipo del resultado de una consulta con esa selección (Prisma lo calcula por nosotros). */
type UsuarioConGimnasio = Prisma.UsuarioGetPayload<{ select: typeof seleccionUsuario }>;

/** Lo mismo para un socio: también trae su gimnasio, para mostrar la marca. */
const seleccionSocio = {
  id: true,
  nombre: true,
  apellido: true,
  email: true,
  activo: true,
  hashContrasena: true,
  gimnasio: seleccionUsuario.gimnasio,
} satisfies Prisma.SocioSelect;

type SocioConGimnasio = Prisma.SocioGetPayload<{ select: typeof seleccionSocio }>;

/** Un usuario puede operar si está activo y su gimnasio (si tiene) también. */
function puedeOperar(usuario: UsuarioConGimnasio): boolean {
  return usuario.activo && (usuario.gimnasio === null || usuario.gimnasio.activo);
}

/** Un socio puede entrar si sigue activo, su gimnasio también y ya activó su cuenta. */
function socioPuedeOperar(socio: SocioConGimnasio): boolean {
  return socio.activo && socio.gimnasio.activo && socio.hashContrasena !== null;
}

/** Datos del gimnasio para el cliente (sin el flag interno `activo`). */
function datosGimnasio({ activo: _activo, ...gimnasio }: SocioConGimnasio['gimnasio']) {
  return gimnasio;
}

/** El socio se muestra con la misma forma que un usuario, con rol 'SOCIO'. */
function socioASesion(socio: SocioConGimnasio): UsuarioSesion {
  return {
    id: socio.id,
    nombre: `${socio.nombre} ${socio.apellido}`,
    email: socio.email,
    rol: 'SOCIO',
    gimnasio: datosGimnasio(socio.gimnasio),
  };
}

/** Convierte el registro de la base en lo que ve el cliente (sin hash ni flags internos). */
function aUsuarioSesion(usuario: UsuarioConGimnasio): UsuarioSesion {
  const gimnasio: GimnasioSesion | null = usuario.gimnasio ? datosGimnasio(usuario.gimnasio) : null;
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol,
    gimnasio,
  };
}

/**
 * Sirve para usuarios y socios (genérico `T`): cualquier cosa con un hash de contraseña.
 * Un socio que todavía no activó su cuenta no tiene hash: se compara contra el falso y falla.
 */
async function verificarContrasena<T extends { hashContrasena: string | null }>(
  cuenta: T | null,
  contrasena: string,
  puedeEntrar: (cuenta: T) => boolean,
): Promise<T> {
  const coincide = await bcrypt.compare(contrasena, cuenta?.hashContrasena ?? HASH_FALSO);
  // Mismo error si no existe, si la contraseña está mal o si está inactivo:
  // no le damos pistas a quien intenta adivinar.
  if (!cuenta || !coincide || !puedeEntrar(cuenta)) throw credencialesInvalidas();
  return cuenta;
}

async function crearSesion(usuario: UsuarioSesion): Promise<SesionIniciada> {
  const tokenRefresco = generarTokenAleatorio();
  const esSocio = usuario.rol === 'SOCIO';
  await prisma.sesion.create({
    data: {
      // La tabla de sesiones guarda a quién pertenece: un usuario O un socio.
      usuarioId: esSocio ? null : usuario.id,
      socioId: esSocio ? usuario.id : null,
      hashToken: hashearToken(tokenRefresco),
      expiraEn: vencimientoTokenRefresco(),
    },
  });
  return {
    tokenAcceso: firmarTokenAcceso({
      usuarioId: usuario.id,
      rol: usuario.rol,
      gimnasioId: usuario.gimnasio?.id ?? null,
    }),
    tokenRefresco,
    usuario,
  };
}

// ───────────────────────────── Casos de uso ─────────────────────────────

/** Login del personal: el email se busca SOLO dentro del gimnasio indicado. */
export async function iniciarSesionStaff(datos: DatosLoginStaff): Promise<SesionIniciada> {
  const usuario = await prisma.usuario.findFirst({
    where: { email: datos.email, gimnasio: { slug: datos.gimnasio }, rol: { not: Rol.SUPERADMIN } },
    select: seleccionUsuario,
  });
  return crearSesion(
    aUsuarioSesion(await verificarContrasena(usuario, datos.contrasena, puedeOperar)),
  );
}

/** Login del socio: DNI + contraseña, dentro del gimnasio indicado. */
export async function iniciarSesionSocio(datos: DatosLoginSocio): Promise<SesionIniciada> {
  const socio = await prisma.socio.findFirst({
    where: { dni: datos.dni, gimnasio: { slug: datos.gimnasio } },
    select: seleccionSocio,
  });
  return crearSesion(
    socioASesion(await verificarContrasena(socio, datos.contrasena, socioPuedeOperar)),
  );
}

export async function iniciarSesionAdmin(datos: DatosLoginAdmin): Promise<SesionIniciada> {
  const usuario = await prisma.usuario.findFirst({
    where: { email: datos.email, rol: Rol.SUPERADMIN },
    select: seleccionUsuario,
  });
  return crearSesion(
    aUsuarioSesion(await verificarContrasena(usuario, datos.contrasena, puedeOperar)),
  );
}

/**
 * Canjea un token de refresco por uno de acceso nuevo, con ROTACIÓN: el token usado se revoca
 * y se entrega uno nuevo. Si alguien roba un token de refresco, solo sirve una vez.
 */
export async function refrescarSesion(tokenRefresco: string | undefined): Promise<SesionIniciada> {
  if (!tokenRefresco) throw sesionInvalida();

  const sesion = await prisma.sesion.findUnique({
    where: { hashToken: hashearToken(tokenRefresco) },
    select: {
      id: true,
      expiraEn: true,
      revocadaEn: true,
      usuario: { select: seleccionUsuario },
      socio: { select: seleccionSocio },
    },
  });
  if (!sesion || sesion.revocadaEn || sesion.expiraEn <= new Date()) throw sesionInvalida();

  // De quién es la sesión (usuario o socio), y si todavía puede entrar.
  let usuario: UsuarioSesion | null = null;
  if (sesion.usuario && puedeOperar(sesion.usuario)) usuario = aUsuarioSesion(sesion.usuario);
  if (sesion.socio && socioPuedeOperar(sesion.socio)) usuario = socioASesion(sesion.socio);
  if (!usuario) throw sesionInvalida();

  // updateMany con la condición "todavía no revocada": si llegan dos pedidos al mismo tiempo
  // con el mismo token, solo uno logra revocarlo (count = 1); el otro falla.
  const { count } = await prisma.sesion.updateMany({
    where: { id: sesion.id, revocadaEn: null },
    data: { revocadaEn: new Date() },
  });
  if (count !== 1) throw sesionInvalida();

  return crearSesion(usuario);
}

/** Cerrar sesión: revoca el token de refresco. Si no hay token o ya no existe, no hace nada. */
export async function cerrarSesion(tokenRefresco: string | undefined): Promise<void> {
  if (!tokenRefresco) return;
  await prisma.sesion.updateMany({
    where: { hashToken: hashearToken(tokenRefresco), revocadaEn: null },
    data: { revocadaEn: new Date() },
  });
}

/** Datos actualizados de quien está logueado (usuario del panel o socio). */
export async function obtenerUsuarioSesion({ usuarioId, rol }: DatosAuth): Promise<UsuarioSesion> {
  if (rol === 'SOCIO') {
    const socio = await prisma.socio.findUnique({
      where: { id: usuarioId },
      select: seleccionSocio,
    });
    if (!socio || !socioPuedeOperar(socio)) throw sesionInvalida();
    return socioASesion(socio);
  }
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: seleccionUsuario,
  });
  if (!usuario || !puedeOperar(usuario)) throw sesionInvalida();
  return aUsuarioSesion(usuario);
}
