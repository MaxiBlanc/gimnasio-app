import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { crearApp } from '../../app';
import { prisma } from '../../db';
import {
  autorizacionDe,
  crearEscenarioBase,
  crearSocioDePrueba,
  vaciarBase,
} from '../../test/datosDePrueba';
import { nivelDeOcupacion } from './ingresos.servicio';

const app = crearApp();
let escenario: Awaited<ReturnType<typeof crearEscenarioBase>>;

const crearSocio = (opciones: Parameters<typeof crearSocioDePrueba>[2] = {}) =>
  crearSocioDePrueba(escenario.gimnasioA.gimnasio, escenario.gimnasioA.dueno.id, opciones);

const ingresar = (dni: string, usuario = escenario.gimnasioA.kiosco) =>
  request(app).post('/api/ingresos').set('Authorization', autorizacionDe(usuario)).send({ dni });

beforeEach(async () => {
  await vaciarBase();
  escenario = await crearEscenarioBase();
  // Fijamos "ahora" en el 15 de noviembre de 2026 (después del día de cierre, el 10).
  // Solo falseamos Date: los timers reales siguen andando (la base de datos los necesita).
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-15T15:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('POST /api/ingresos (tablet de la entrada)', () => {
  it('registra la entrada de un socio al día', async () => {
    await crearSocio({ pagoHasta: '2026-11-30' });
    const respuesta = await ingresar('30.111.222');

    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toEqual({
      socio: { nombre: 'Juan', apellido: 'Pérez' },
      cuota: { estado: 'AL_DIA', vencimiento: '2026-11-30' },
      repetido: false,
    });
    expect(await prisma.ingreso.count()).toBe(1);
  });

  it('con la cuota vencida avisa, pero igual registra la entrada (marcada)', async () => {
    await crearSocio({ pagoHasta: '2026-10-31' });
    const respuesta = await ingresar('30111222');

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.cuota.estado).toBe('VENCIDO');
    const ingreso = await prisma.ingreso.findFirstOrThrow();
    expect(ingreso.cuotaVencida).toBe(true);
  });

  it('si vuelve a marcar enseguida, no cuenta dos veces', async () => {
    await crearSocio({ pagoHasta: '2026-11-30' });
    await ingresar('30111222');
    const segunda = await ingresar('30111222');

    expect(segunda.body.repetido).toBe(true);
    expect(await prisma.ingreso.count()).toBe(1);
  });

  it('DNI inexistente, de otro gimnasio o dado de baja: no entra', async () => {
    await crearSocioDePrueba(escenario.gimnasioB.gimnasio, escenario.gimnasioB.dueno.id, {
      dni: '40111222',
    });
    await crearSocio({ dni: '30999888', activo: false });

    expect((await ingresar('11222333')).status).toBe(404);
    expect((await ingresar('40111222')).status).toBe(404);
    expect((await ingresar('30999888')).status).toBe(409);
    expect(await prisma.ingreso.count()).toBe(0);
  });

  it('el profesor no puede registrar ingresos', async () => {
    await crearSocio();
    expect((await ingresar('30111222', escenario.gimnasioA.profesor)).status).toBe(403);
  });
});

describe('GET /api/ocupacion', () => {
  it('cuenta los socios que entraron dentro del tiempo de permanencia', async () => {
    const { gimnasio } = escenario.gimnasioA;
    await prisma.gimnasio.update({ where: { id: gimnasio.id }, data: { capacidadMaxima: 4 } });
    const [a, b, c] = await Promise.all(
      ['30000001', '30000002', '30000003'].map((dni) => crearSocio({ dni })),
    );
    const haceMinutos = (minutos: number) => new Date(Date.now() - minutos * 60_000);
    await prisma.ingreso.createMany({
      data: [
        { gimnasioId: gimnasio.id, socioId: a!.id, creadoEn: haceMinutos(10) },
        { gimnasioId: gimnasio.id, socioId: b!.id, creadoEn: haceMinutos(80) },
        // Entró hace 2 horas: con 90 minutos de permanencia, ya se fue.
        { gimnasioId: gimnasio.id, socioId: c!.id, creadoEn: haceMinutos(120) },
      ],
    });

    const respuesta = await request(app)
      .get('/api/ocupacion')
      .set('Authorization', autorizacionDe(escenario.gimnasioA.recepcion));

    expect(respuesta.body).toEqual({
      personas: 2,
      capacidadMaxima: 4,
      nivel: 'MEDIA',
      minutosPermanencia: 90,
    });
  });

  it('el nivel depende de la capacidad (sin capacidad, no hay nivel)', () => {
    expect(nivelDeOcupacion(5, null)).toBeNull();
    expect(nivelDeOcupacion(3, 10)).toBe('BAJA');
    expect(nivelDeOcupacion(5, 10)).toBe('MEDIA');
    expect(nivelDeOcupacion(9, 10)).toBe('ALTA');
  });
});

describe('GET /api/mi-cuenta (socio)', () => {
  it('el socio ve su cuota, sus pagos y cuántas veces vino este mes', async () => {
    const socio = await crearSocio({ pagoHasta: '2026-11-30' });
    await ingresar('30111222');
    const token = autorizacionDe({
      id: socio.id,
      roles: ['SOCIO'],
      gimnasioId: escenario.gimnasioA.gimnasio.id,
    });

    const respuesta = await request(app).get('/api/mi-cuenta').set('Authorization', token);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({
      nombre: 'Juan',
      dni: '30111222',
      plan: { precio: 20000, duracionMeses: 1 },
      cuota: { estado: 'AL_DIA', vencimiento: '2026-11-30' },
      ingresosDelMes: 1,
    });
    expect(respuesta.body.pagos).toHaveLength(1);
  });

  it('el personal no tiene "mi cuenta" de socio', async () => {
    const respuesta = await request(app)
      .get('/api/mi-cuenta')
      .set('Authorization', autorizacionDe(escenario.gimnasioA.dueno));
    expect(respuesta.status).toBe(403);
  });
});
