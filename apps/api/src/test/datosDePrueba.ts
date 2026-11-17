import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { Rol } from '../generated/prisma/enums';

export const CONTRASENA_PRUEBA = 'Clave1234';

/**
 * Vacía todas las tablas de la base de tests.
 * TRUNCATE es mucho más rápido que DELETE y CASCADE vacía también las tablas relacionadas.
 */
export async function vaciarBase() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE pagos, sesiones, tokens_socio, socios, descuentos, planes, usuarios, gimnasios
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
