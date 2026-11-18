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
import { proximasClases } from '../src/dominio/agenda';
import { hoyEnArgentina, mesDeFecha, periodoDePago, sumarMeses } from '../src/dominio/periodos';
import { textoBusquedaSocio } from '../src/modulos/socios/socios.servicio';

// En producción se pasan otras contraseñas por variable de entorno, para que las de
// este archivo (que están en el README) no sirvan para entrar a la demo publicada.
const CONTRASENA_STAFF = process.env['SEED_CONTRASENA_STAFF'] ?? 'Gimnasio123';
const CONTRASENA_SOCIO = process.env['SEED_CONTRASENA_SOCIO'] ?? 'Socio1234';

async function limpiarBase() {
  await prisma.inscripcion.deleteMany();
  await prisma.clase.deleteMany();
  await prisma.rutina.deleteMany();
  // Orden inverso a las dependencias: primero lo que apunta a otras tablas.
  await prisma.avisoEnviado.deleteMany();
  await prisma.ingreso.deleteMany();
  await prisma.pago.deleteMany();
  await prisma.sesion.deleteMany();
  await prisma.tokenSocio.deleteMany();
  await prisma.socio.deleteMany();
  await prisma.descuento.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.gimnasio.deleteMany();
}

/**
 * Entradas de ejemplo de las últimas 4 semanas, para que el tablero del dueño y la
 * ocupación muestren algo. Usamos un generador "pseudoaleatorio" con semilla fija:
 * cada vez que corrés el seed salen los mismos datos (más fácil de comparar).
 */
async function cargarIngresos(gimnasioId: string, socios: string[]) {
  let semilla = 42;
  const azar = () => {
    semilla = (semilla * 1103515245 + 12345) % 2 ** 31;
    return semilla / 2 ** 31;
  };
  // Horas pico de un gimnasio: temprano, mediodía y después del trabajo.
  const HORAS = [7, 8, 8, 9, 12, 13, 18, 18, 19, 19, 20, 21];
  const HORA_MS = 60 * 60 * 1000;
  const ahora = Date.now();
  // 00:00 de hoy en Argentina (UTC-3), en milisegundos.
  const hoy = new Date(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(ahora) +
      'T03:00:00Z',
  ).getTime();

  const datos: { gimnasioId: string; socioId: string; creadoEn: Date }[] = [];
  for (let dia = 28; dia >= 0; dia--) {
    for (const socioId of socios) {
      if (azar() > 0.5) continue; // cada socio viene más o menos día por medio
      const hora = HORAS[Math.floor(azar() * HORAS.length)]!;
      const creadoEn = hoy - dia * 24 * HORA_MS + (hora + azar()) * HORA_MS;
      if (creadoEn < ahora) datos.push({ gimnasioId, socioId, creadoEn: new Date(creadoEn) });
    }
  }
  // Y algunos que llegaron hace un rato, para que la ocupación no esté en cero.
  for (const [i, socioId] of socios.slice(0, 3).entries()) {
    datos.push({ gimnasioId, socioId, creadoEn: new Date(ahora - (10 + i * 15) * 60 * 1000) });
  }
  await prisma.ingreso.createMany({ data: datos });
}

/** Cronograma semanal, dos plantillas de rutina y algunos anotados en la agenda. */
async function cargarClasesYRutinas(gimnasioId: string, profeId: string, socios: string[]) {
  const cronograma = [
    { nombre: 'Funcional', dias: [1, 3, 5], hora: '19:00', cupo: 12 },
    { nombre: 'Spinning', dias: [2, 4], hora: '08:00', cupo: 10 },
    { nombre: 'Yoga', dias: [6], hora: '10:30', cupo: 15 },
  ];
  const clases = [];
  for (const item of cronograma) {
    for (const diaSemana of item.dias) {
      clases.push(
        await prisma.clase.create({
          data: {
            gimnasioId,
            nombre: item.nombre,
            profesorId: profeId,
            diaSemana,
            horaInicio: item.hora,
            duracionMinutos: 60,
            cupo: item.cupo,
          },
        }),
      );
    }
  }

  // Anotados en las próximas clases (cantidades fijas para que la demo sea igual siempre).
  const proximas = proximasClases(clases, new Date());
  for (const [i, { clase, fecha }] of proximas.entries()) {
    const cantidad = Math.min(clase.cupo, [3, 7, clase.cupo, 5][i % 4] ?? 0, socios.length);
    await prisma.inscripcion.createMany({
      data: socios.slice(0, cantidad).map((socioId) => ({
        gimnasioId,
        claseId: clase.id,
        socioId,
        fecha: new Date(`${fecha}T00:00:00Z`),
      })),
    });
  }

  const ejercicio = (nombre: string, series: number, repeticiones: string) => ({
    nombre,
    series,
    repeticiones,
    descanso: '90 s',
    notas: '',
  });
  await prisma.rutina.createMany({
    data: [
      {
        gimnasioId,
        creadaPorId: profeId,
        nombre: 'Principiante full body',
        descripcion: 'Tres veces por semana, con un día de descanso entre medio.',
        dias: [
          {
            nombre: 'Día A',
            ejercicios: [
              ejercicio('Sentadilla goblet', 3, '12'),
              ejercicio('Press de pecho con mancuernas', 3, '10'),
              ejercicio('Remo con mancuerna', 3, '10 por lado'),
              ejercicio('Plancha', 3, '30 s'),
            ],
          },
          {
            nombre: 'Día B',
            ejercicios: [
              ejercicio('Peso muerto rumano', 3, '10'),
              ejercicio('Press militar', 3, '10'),
              ejercicio('Jalón al pecho', 3, '12'),
              ejercicio('Estocadas', 3, '10 por pierna'),
            ],
          },
        ],
      },
      {
        gimnasioId,
        creadaPorId: profeId,
        nombre: 'Hipertrofia torso / piernas',
        descripcion: 'Cuatro días: torso, piernas, torso, piernas.',
        dias: [
          {
            nombre: 'Torso',
            ejercicios: [
              ejercicio('Press banca', 4, '8-10'),
              ejercicio('Remo con barra', 4, '8-10'),
              ejercicio('Vuelos laterales', 3, '15'),
            ],
          },
          {
            nombre: 'Piernas',
            ejercicios: [
              ejercicio('Sentadilla', 4, '8'),
              ejercicio('Prensa', 3, '12'),
              ejercicio('Curl femoral', 3, '12'),
            ],
          },
        ],
      },
    ],
  });
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
      roles: [Rol.SUPERADMIN],
    },
  });

  // ── Gimnasio principal ──
  const power = await prisma.gimnasio.create({
    data: {
      nombre: 'Power Gym',
      slug: 'power-gym',
      colorPrimario: '#FFC300',
      colorSecundario: '#1A1E23',
      capacidadMaxima: 20, // chico, para que con los socios de prueba la ocupación se mueva
    },
  });

  const staff = [
    { nombre: 'Martín Dueño', email: 'dueno@powergym.com', roles: [Rol.DUENO] },
    { nombre: 'Laura Recepción', email: 'recepcion@powergym.com', roles: [Rol.RECEPCION] },
    { nombre: 'Pablo Profesor', email: 'profe@powergym.com', roles: [Rol.PROFESOR] },
    { nombre: 'Tablet de ingreso', email: 'ingreso@powergym.com', roles: [Rol.KIOSCO] },
    {
      nombre: 'Carla Recepción y Profe',
      email: 'carla@powergym.com',
      roles: [Rol.RECEPCION, Rol.PROFESOR],
    },
  ];
  await prisma.usuario.createMany({
    data: staff.map((u) => ({ ...u, gimnasioId: power.id, hashContrasena: hashStaff })),
  });
  const recepcion = await prisma.usuario.findFirstOrThrow({
    where: { gimnasioId: power.id, email: 'recepcion@powergym.com' },
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

  const sociosPower: string[] = [];
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
    sociosPower.push(socio.id);

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

  await cargarIngresos(power.id, sociosPower);
  const profe = await prisma.usuario.findFirstOrThrow({
    where: { gimnasioId: power.id, email: 'profe@powergym.com' },
  });
  await cargarClasesYRutinas(power.id, profe.id, sociosPower);
  // Juan (el socio con login) ya tiene su copia de la plantilla, como si se la hubiera asignado el profe.
  const plantilla = await prisma.rutina.findFirstOrThrow({
    where: { gimnasioId: power.id, socioId: null, nombre: 'Principiante full body' },
  });
  const juan = await prisma.socio.findFirstOrThrow({
    where: { gimnasioId: power.id, dni: '30111222' },
  });
  await prisma.rutina.create({
    data: {
      gimnasioId: power.id,
      socioId: juan.id,
      creadaPorId: profe.id,
      nombre: plantilla.nombre,
      descripcion: plantilla.descripcion,
      dias: plantilla.dias ?? [],
    },
  });

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
      roles: [Rol.DUENO],
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
    ingresos: await prisma.ingreso.count(),
    gimnasios: await prisma.gimnasio.count(),
    usuarios: await prisma.usuario.count(),
    socios: await prisma.socio.count(),
    pagos: await prisma.pago.count(),
    clases: await prisma.clase.count(),
    inscripciones: await prisma.inscripcion.count(),
  };
  console.log('🌱 Seed listo:', totales);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
