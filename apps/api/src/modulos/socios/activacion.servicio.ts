import bcrypt from 'bcryptjs';
import type { DatosActivarCuenta } from '@gimnasio/compartido';
import { entorno } from '../../config/entorno';
import { prisma } from '../../db';
import { ErrorApp } from '../../errores';
import { TipoTokenSocio } from '../../generated/prisma/enums';
import { generarTokenAleatorio, hashearToken } from '../auth/tokens';
import { enviarCorreo } from '../correo/correo';
import { correoActivacion } from '../correo/plantillas';

/**
 * Flujo de activación de la cuenta del socio:
 *   1. Recepción da de alta al socio → se genera un token y se le manda un link por mail.
 *   2. El socio abre el link y elige su contraseña → se guarda y el token queda usado.
 *
 * Así, para crear la contraseña hay que tener acceso al MAIL del socio:
 * no alcanza con conocer su DNI.
 */

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Genera un token nuevo y manda el mail. Devuelve si el mail salió.
 * Los tokens de activación anteriores que no se usaron se eliminan: solo vale el último link.
 */
export async function enviarActivacion(gimnasioId: string, socioId: string): Promise<boolean> {
  const socio = await prisma.socio.findFirst({
    where: { id: socioId, gimnasioId },
    select: {
      nombre: true,
      email: true,
      gimnasio: {
        select: { nombre: true, slug: true, colorPrimario: true, colorSecundario: true },
      },
    },
  });
  if (!socio) throw new ErrorApp(404, 'SOCIO_NO_ENCONTRADO', 'No existe ese socio');

  const token = generarTokenAleatorio();
  await prisma.$transaction([
    prisma.tokenSocio.deleteMany({
      where: { socioId, tipo: TipoTokenSocio.ACTIVACION, usadoEn: null },
    }),
    prisma.tokenSocio.create({
      data: {
        gimnasioId,
        socioId,
        tipo: TipoTokenSocio.ACTIVACION,
        hashToken: hashearToken(token),
        expiraEn: new Date(Date.now() + entorno.DIAS_VALIDEZ_ACTIVACION * DIA_MS),
      },
    }),
  ]);

  const enlace = `${entorno.ORIGEN_WEB}/g/${socio.gimnasio.slug}/activar?token=${token}`;
  try {
    await enviarCorreo(
      correoActivacion({
        para: socio.email,
        nombreSocio: socio.nombre,
        gimnasio: socio.gimnasio,
        enlace,
        diasValidez: entorno.DIAS_VALIDEZ_ACTIVACION,
      }),
    );
    return true;
  } catch (error) {
    console.error('No se pudo enviar el mail de activación:', error);
    return false;
  }
}

/** Reenvío pedido por recepción. Solo tiene sentido si el socio todavía no creó su contraseña. */
export async function reenviarActivacion(gimnasioId: string, socioId: string): Promise<boolean> {
  const socio = await prisma.socio.findFirst({
    where: { id: socioId, gimnasioId },
    select: { hashContrasena: true, activo: true },
  });
  if (!socio) throw new ErrorApp(404, 'SOCIO_NO_ENCONTRADO', 'No existe ese socio');
  if (!socio.activo) throw new ErrorApp(409, 'SOCIO_DADO_DE_BAJA', 'El socio está dado de baja');
  if (socio.hashContrasena) {
    throw new ErrorApp(409, 'CUENTA_YA_ACTIVADA', 'El socio ya activó su cuenta');
  }
  return enviarActivacion(gimnasioId, socioId);
}

/**
 * El socio canjea el token por su contraseña. Público (sin login): la "prueba" es el token.
 * Devuelve el slug del gimnasio para que la web lo lleve a la pantalla de login.
 */
export async function activarCuenta(datos: DatosActivarCuenta): Promise<{ gimnasio: string }> {
  const enlaceInvalido = () =>
    new ErrorApp(
      400,
      'ENLACE_INVALIDO',
      'El enlace no es válido o ya venció. Pedí uno nuevo en recepción.',
    );

  const token = await prisma.tokenSocio.findUnique({
    where: { hashToken: hashearToken(datos.token) },
    select: {
      id: true,
      tipo: true,
      expiraEn: true,
      usadoEn: true,
      socio: {
        select: { id: true, activo: true, gimnasio: { select: { slug: true, activo: true } } },
      },
    },
  });
  if (
    !token ||
    token.tipo !== TipoTokenSocio.ACTIVACION ||
    token.usadoEn ||
    token.expiraEn <= new Date() ||
    !token.socio.activo ||
    !token.socio.gimnasio.activo
  ) {
    throw enlaceInvalido();
  }

  const hashContrasena = await bcrypt.hash(datos.contrasena, 10);

  await prisma.$transaction(async (tx) => {
    // Marcamos el token como usado SOLO si nadie lo usó en el medio (dos clics seguidos, por ejemplo).
    const { count } = await tx.tokenSocio.updateMany({
      where: { id: token.id, usadoEn: null },
      data: { usadoEn: new Date() },
    });
    if (count !== 1) throw enlaceInvalido();
    await tx.socio.update({ where: { id: token.socio.id }, data: { hashContrasena } });
  });

  return { gimnasio: token.socio.gimnasio.slug };
}
