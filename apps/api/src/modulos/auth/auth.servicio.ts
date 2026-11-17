import bcrypt from 'bcryptjs';
import type {
  DatosLoginAdmin,
  DatosLoginStaff,
  GimnasioSesion,
  UsuarioSesion,
} from '@gimnasio/compartido';
import { prisma } from '../../db';
import { ErrorApp } from '../../errores';
import type { Prisma } from '../../generated/prisma/client';
import { Rol } from '../../generated/prisma/enums';
import {
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

/** Un usuario puede operar si está activo y su gimnasio (si tiene) también. */
function puedeOperar(usuario: UsuarioConGimnasio): boolean {
  return usuario.activo && (usuario.gimnasio === null || usuario.gimnasio.activo);
}

/** Convierte el registro de la base en lo que ve el cliente (sin hash ni flags internos). */
function aUsuarioSesion(usuario: UsuarioConGimnasio): UsuarioSesion {
  let gimnasio: GimnasioSesion | null = null;
  if (usuario.gimnasio) {
    const { activo: _activo, ...datosGimnasio } = usuario.gimnasio;
    gimnasio = datosGimnasio;
  }
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol,
    gimnasio,
  };
}

async function verificarContrasena(usuario: UsuarioConGimnasio | null, contrasena: string) {
  const coincide = await bcrypt.compare(contrasena, usuario?.hashContrasena ?? HASH_FALSO);
  // Mismo error si no existe, si la contraseña está mal o si está inactivo:
  // no le damos pistas a quien intenta adivinar.
  if (!usuario || !coincide || !puedeOperar(usuario)) throw credencialesInvalidas();
  return usuario;
}

async function crearSesion(usuario: UsuarioConGimnasio): Promise<SesionIniciada> {
  const tokenRefresco = generarTokenAleatorio();
  await prisma.sesion.create({
    data: {
      usuarioId: usuario.id,
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
    usuario: aUsuarioSesion(usuario),
  };
}

// ───────────────────────────── Casos de uso ─────────────────────────────

/** Login del personal: el email se busca SOLO dentro del gimnasio indicado. */
export async function iniciarSesionStaff(datos: DatosLoginStaff): Promise<SesionIniciada> {
  const usuario = await prisma.usuario.findFirst({
    where: { email: datos.email, gimnasio: { slug: datos.gimnasio }, rol: { not: Rol.SUPERADMIN } },
    select: seleccionUsuario,
  });
  return crearSesion(await verificarContrasena(usuario, datos.contrasena));
}

export async function iniciarSesionAdmin(datos: DatosLoginAdmin): Promise<SesionIniciada> {
  const usuario = await prisma.usuario.findFirst({
    where: { email: datos.email, rol: Rol.SUPERADMIN },
    select: seleccionUsuario,
  });
  return crearSesion(await verificarContrasena(usuario, datos.contrasena));
}

/**
 * Canjea un token de refresco por uno de acceso nuevo, con ROTACIÓN: el token usado se revoca
 * y se entrega uno nuevo. Si alguien roba un token de refresco, solo sirve una vez.
 */
export async function refrescarSesion(tokenRefresco: string | undefined): Promise<SesionIniciada> {
  if (!tokenRefresco) throw sesionInvalida();

  const sesion = await prisma.sesion.findUnique({
    where: { hashToken: hashearToken(tokenRefresco) },
    select: { id: true, expiraEn: true, revocadaEn: true, usuario: { select: seleccionUsuario } },
  });
  if (!sesion || sesion.revocadaEn || sesion.expiraEn <= new Date() || !sesion.usuario) {
    throw sesionInvalida();
  }
  if (!puedeOperar(sesion.usuario)) throw sesionInvalida();

  // updateMany con la condición "todavía no revocada": si llegan dos pedidos al mismo tiempo
  // con el mismo token, solo uno logra revocarlo (count = 1); el otro falla.
  const { count } = await prisma.sesion.updateMany({
    where: { id: sesion.id, revocadaEn: null },
    data: { revocadaEn: new Date() },
  });
  if (count !== 1) throw sesionInvalida();

  return crearSesion(sesion.usuario);
}

/** Cerrar sesión: revoca el token de refresco. Si no hay token o ya no existe, no hace nada. */
export async function cerrarSesion(tokenRefresco: string | undefined): Promise<void> {
  if (!tokenRefresco) return;
  await prisma.sesion.updateMany({
    where: { hashToken: hashearToken(tokenRefresco), revocadaEn: null },
    data: { revocadaEn: new Date() },
  });
}

/** Datos actualizados del usuario logueado. */
export async function obtenerUsuarioSesion(usuarioId: string): Promise<UsuarioSesion> {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: seleccionUsuario,
  });
  if (!usuario || !puedeOperar(usuario)) throw sesionInvalida();
  return aUsuarioSesion(usuario);
}
