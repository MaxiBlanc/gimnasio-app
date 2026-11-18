import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import type { RolSesion } from '@gimnasio/compartido';
import { Rol } from '../generated/prisma/enums';
import { firmarTokenAcceso } from '../modulos/auth/tokens';

export const CONTRASENA_PRUEBA = 'Clave1234';

/**
 * Header Authorization listo para usar en un test, firmado directamente (sin pasar por /login).
 * El login ya tiene sus propios tests; acá solo queremos "ser" ese usuario.
 */
export function autorizacionDe(usuario: { id: string; rol: RolSesion; gimnasioId: string | null }) {
  return `Bearer ${firmarTokenAcceso({ usuarioId: usuario.id, rol: usuario.rol, gimnasioId: usuario.gimnasioId })}`;
}

/**
 * Vacía todas las tablas de la base de tests.
 * TRUNCATE es mucho más rápido que DELETE y CASCADE vacía también las tablas relacionadas.
 */
export async function vaciarBase() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE avisos_enviados, ingresos, pagos, sesiones, tokens_socio, socios, descuentos, planes, usuarios, gimnasios
    RESTART IDENTITY CASCADE
  `);
}

/**
 * Crea un escenario mínimo: dos gimnasios, cada uno con usuarios de cada rol, y un súper-admin.
 * Usamos un costo de bcrypt bajo (4) para que los tests sean rápidos; en la app real es 10.
 */
export async function crearEscenarioBase() {
  const hash = await bcrypt.hash(CONTRASENA_PRUEBA, 4);

  const crearGimnasio = async (nombre: string, slug: string) => {
    const gimnasio = await prisma.gimnasio.create({ data: { nombre, slug } });
    const usuario = (rol: Rol, prefijo: string) =>
      prisma.usuario.create({
        data: {
          gimnasioId: gimnasio.id,
          nombre: `${prefijo} ${nombre}`,
          email: `${prefijo}@${slug}.com`,
          hashContrasena: hash,
          rol,
        },
      });
    return {
      gimnasio,
      dueno: await usuario(Rol.DUENO, 'dueno'),
      recepcion: await usuario(Rol.RECEPCION, 'recepcion'),
      profesor: await usuario(Rol.PROFESOR, 'profe'),
      kiosco: await usuario(Rol.KIOSCO, 'ingreso'),
    };
  };

  const superadmin = await prisma.usuario.create({
    data: {
      nombre: 'Súper Admin',
      email: 'admin@test.com',
      hashContrasena: hash,
      rol: Rol.SUPERADMIN,
    },
  });

  return {
    superadmin,
    gimnasioA: await crearGimnasio('Gimnasio A', 'gimnasio-a'),
    gimnasioB: await crearGimnasio('Gimnasio B', 'gimnasio-b'),
  };
}

/**
 * Crea un socio (con su plan) en un gimnasio. Con `activado`, ya tiene contraseña.
 * `pagoHasta` ("AAAA-MM-DD") le registra un pago que cubre hasta esa fecha.
 */
export async function crearSocioDePrueba(
  gimnasio: { id: string },
  registradoPorId: string,
  {
    activado = true,
    activo = true,
    dni = '30111222',
    pagoHasta,
  }: { activado?: boolean; activo?: boolean; dni?: string; pagoHasta?: string } = {},
) {
  const plan = await prisma.plan.create({
    data: { gimnasioId: gimnasio.id, nombre: `Mensual ${dni}`, precio: 20000, duracionMeses: 1 },
  });
  const socio = await prisma.socio.create({
    data: {
      gimnasioId: gimnasio.id,
      nombre: 'Juan',
      apellido: 'Pérez',
      dni,
      telefono: '1155551234',
      email: `socio${dni}@ejemplo.com`,
      emergenciaNombre: 'Ana',
      emergenciaTelefono: '1155554321',
      planId: plan.id,
      activo,
      hashContrasena: activado ? await bcrypt.hash(CONTRASENA_PRUEBA, 4) : null,
    },
  });
  if (pagoHasta) {
    const hasta = new Date(`${pagoHasta}T00:00:00Z`);
    await prisma.pago.create({
      data: {
        gimnasioId: gimnasio.id,
        socioId: socio.id,
        planId: plan.id,
        periodoDesde: new Date(Date.UTC(hasta.getUTCFullYear(), hasta.getUTCMonth(), 1)),
        periodoHasta: hasta,
        montoBase: 20000,
        montoFinal: 20000,
        formaPago: 'EFECTIVO',
        registradoPorId,
      },
    });
  }
  return socio;
}
