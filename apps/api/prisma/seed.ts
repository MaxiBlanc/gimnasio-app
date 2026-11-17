/**
 * Datos de prueba para desarrollo: `npm run db:seed` (o automáticamente con `db:reset`).
 *
 * Crea dos gimnasios para poder probar el aislamiento entre tenants, usuarios de cada rol
 * y socios en distintos estados de cuota. Los pagos se generan RELATIVOS al mes actual,
 * así los estados (al día, vencido...) tienen sentido cualquier día que corras el seed.
 *
 * Las contraseñas de prueba están documentadas en el README.
 */
import bcrypt from 'bcryptjs';
import { normalizarTexto } from '@gimnasio/compartido';
import { prisma } from '../src/db';
import { FormaPago, Rol, TipoDescuento } from '../src/generated/prisma/enums';
import { hoyEnArgentina, mesDeFecha, periodoDePago, sumarMeses } from '../src/dominio/periodos';
import { textoBusquedaSocio } from '../src/modulos/socios/socios.servicio';

const CONTRASENA_STAFF = 'Gimnasio123';
const CONTRASENA_SOCIO = 'Socio1234';

async function limpiarBase() {
  // Orden inverso a las dependencias: primero lo que apunta a otras tablas.
  await prisma.pago.deleteMany();
  await prisma.sesion.deleteMany();
  await prisma.tokenSocio.deleteMany();
  await prisma.socio.deleteMany();
  await prisma.descuento.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.gimnasio.deleteMany();
}

async function main() {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('El seed borra la base: no se puede correr en producción.');
  }

  await limpiarBase();

  // bcrypt es lento A PROPÓSITO (dificulta adivinar contraseñas por fuerza bruta).
  // Hasheamos una vez y reutilizamos el resultado.
  const hashStaff = await bcrypt.hash(CONTRASENA_STAFF, 10);
  const hashSocio = await bcrypt.hash(CONTRASENA_SOCIO, 10);

  // ── Súper-admin (sin gimnasio) ──
  await prisma.usuario.create({
    data: {
      nombre: 'Súper Admin',
      email: 'admin@gimnasioapp.com',
      hashContrasena: hashStaff,
      rol: Rol.SUPERADMIN,
    },
  });

  // ── Gimnasio principal ──
  const power = await prisma.gimnasio.create({
    data: {
      nombre: 'Power Gym',
      slug: 'power-gym',
      colorPrimario: '#E4FF3A',
      colorSecundario: '#111111',
      capacidadMaxima: 80,
    },
  });

  const staff = [
    { nombre: 'Martín Dueño', email: 'dueno@powergym.com', rol: Rol.DUENO },
    { nombre: 'Laura Recepción', email: 'recepcion@powergym.com', rol: Rol.RECEPCION },
    { nombre: 'Pablo Profesor', email: 'profe@powergym.com', rol: Rol.PROFESOR },
    { nombre: 'Tablet de ingreso', email: 'ingreso@powergym.com', rol: Rol.KIOSCO },
  ];
  await prisma.usuario.createMany({
    data: staff.map((u) => ({ ...u, gimnasioId: power.id, hashContrasena: hashStaff })),
  });
  const recepcion = await prisma.usuario.findFirstOrThrow({
    where: { gimnasioId: power.id, rol: Rol.RECEPCION },
  });

  const mensual = await prisma.plan.create({
    data: { gimnasioId: power.id, nombre: 'Mensual', precio: 30000, duracionMeses: 1 },
  });
  const trimestral = await prisma.plan.create({
    data: { gimnasioId: power.id, nombre: 'Trimestral', precio: 81000, duracionMeses: 3 },
  });
  await prisma.plan.create({
    data: { gimnasioId: power.id, nombre: 'Anual', precio: 300000, duracionMeses: 12 },
  });

  const estudiante = await prisma.descuento.create({
    data: {
      gimnasioId: power.id,
      nombre: 'Estudiante',
      tipo: TipoDescuento.PORCENTAJE,
      valor: 10,
    },
  });
  await prisma.descuento.create({
    data: {
      gimnasioId: power.id,
      nombre: 'Promo amigos',
      tipo: TipoDescuento.MONTO_FIJO,
      valor: 5000,
    },
  });

  // ── Socios: cada uno representa un caso distinto ──
  const mesActual = mesDeFecha(hoyEnArgentina());
  const hace = (meses: number) => sumarMeses(mesActual, -meses);

  type CasoSocio = {
    nombre: string;
    apellido: string;
    dni: string;
    plan: typeof mensual;
    conDescuento?: boolean;
    conContrasena?: boolean;
    /** Pagos a registrar: mes inicial de cada uno (cubre la duración del plan). */
    pagosDesde: { anio: number; mes: number }[];
    /** Un pago extra que se registró y después se anuló. */
    pagoAnuladoDesde?: { anio: number; mes: number };
  };

  const casos: CasoSocio[] = [
    // Al día, con historial y con cuenta activada (para probar el login de socio).
    {
      nombre: 'Juan',
      apellido: 'Pérez',
      dni: '30111222',
      plan: mensual,
      conContrasena: true,
      pagosDesde: [hace(2), hace(1), mesActual],
    },
    // Al día con plan trimestral que arrancó el mes pasado.
    {
      nombre: 'María',
      apellido: 'Gómez',
      dni: '32444555',
      plan: trimestral,
      pagosDesde: [hace(1)],
    },
    // Al día, estudiante con 10% de descuento.
    {
      nombre: 'Sofía',
      apellido: 'Martínez',
      dni: '41222333',
      plan: mensual,
      conDescuento: true,
      pagosDesde: [hace(1), mesActual],
    },
    // Pagó hasta el mes pasado: pendiente o vencido según el día del mes.
    {
      nombre: 'Carlos',
      apellido: 'López',
      dni: '28999000',
      plan: mensual,
      pagosDesde: [hace(3), hace(2), hace(1)],
    },
    // Hace dos meses que no paga, y tiene un pago anulado por error de carga.
    {
      nombre: 'Diego',
      apellido: 'Ruiz',
      dni: '35666777',
      plan: mensual,
      pagosDesde: [hace(3), hace(2)],
      pagoAnuladoDesde: hace(1),
    },
    // Recién anotado, todavía no pagó nunca.
    { nombre: 'Ana', apellido: 'Torres', dni: '44888999', plan: mensual, pagosDesde: [] },
    // Ya pagó el mes que viene: al día.
    {
      nombre: 'Valentina',
      apellido: 'Díaz',
      dni: '39123456',
      plan: mensual,
      pagosDesde: [mesActual, sumarMeses(mesActual, 1)],
    },
  ];

  for (const caso of casos) {
    const socio = await prisma.socio.create({
      data: {
        gimnasioId: power.id,
        nombre: caso.nombre,
        apellido: caso.apellido,
        dni: caso.dni,
        telefono: '11 5555-' + caso.dni.slice(-4),
        email: normalizarTexto(`${caso.nombre}.${caso.apellido}@ejemplo.com`), // sin acentos
        emergenciaNombre: 'Contacto de ' + caso.nombre,
        emergenciaTelefono: '11 4444-' + caso.dni.slice(-4),
        planId: caso.plan.id,
        descuentoId: caso.conDescuento ? estudiante.id : null,
        hashContrasena: caso.conContrasena ? hashSocio : null,
        textoBusqueda: textoBusquedaSocio(caso),
      },
    });

    const precio = Number(caso.plan.precio);
    const descuento = caso.conDescuento ? precio * 0.1 : 0;
    const datosPago = (desde: { anio: number; mes: number }) => ({
      gimnasioId: power.id,
      socioId: socio.id,
      planId: caso.plan.id,
      ...periodoDePago(desde, caso.plan.duracionMeses),
      montoBase: precio,
      montoDescuento: descuento,
      montoFinal: precio - descuento,
      descuentoNombre: caso.conDescuento ? estudiante.nombre : null,
      formaPago: FormaPago.EFECTIVO,
      registradoPorId: recepcion.id,
    });

    for (const desde of caso.pagosDesde) {
      await prisma.pago.create({ data: datosPago(desde) });
    }
    if (caso.pagoAnuladoDesde) {
      await prisma.pago.create({
        data: {
          ...datosPago(caso.pagoAnuladoDesde),
          formaPago: FormaPago.TRANSFERENCIA,
          anuladoEn: new Date(),
          anuladoPorId: recepcion.id,
          motivoAnulacion: 'La transferencia no se acreditó',
        },
      });
    }
  }

  // ── Segundo gimnasio: sirve para comprobar que nadie ve datos de otro gimnasio ──
  const titan = await prisma.gimnasio.create({
    data: { nombre: 'Titan Fitness', slug: 'titan-fitness', colorPrimario: '#FF5A1F' },
  });
  await prisma.usuario.create({
    data: {
      gimnasioId: titan.id,
      nombre: 'Rocío Dueña',
      email: 'duena@titanfitness.com',
      hashContrasena: hashStaff,
      rol: Rol.DUENO,
    },
  });
  const planTitan = await prisma.plan.create({
    data: { gimnasioId: titan.id, nombre: 'Mensual', precio: 28000, duracionMeses: 1 },
  });
  // Mismo DNI que Juan Pérez de Power Gym: es válido porque el DNI es único POR gimnasio.
  await prisma.socio.create({
    data: {
      gimnasioId: titan.id,
      nombre: 'Juan',
      apellido: 'Pérez',
      dni: '30111222',
      telefono: '11 5555-1222',
      email: 'juan.perez@ejemplo.com',
      emergenciaNombre: 'Contacto de Juan',
      emergenciaTelefono: '11 4444-1222',
      planId: planTitan.id,
      textoBusqueda: textoBusquedaSocio({ nombre: 'Juan', apellido: 'Pérez', dni: '30111222' }),
    },
  });

  const totales = {
    gimnasios: await prisma.gimnasio.count(),
    usuarios: await prisma.usuario.count(),
    socios: await prisma.socio.count(),
    pagos: await prisma.pago.count(),
  };
  console.log('🌱 Seed listo:', totales);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
