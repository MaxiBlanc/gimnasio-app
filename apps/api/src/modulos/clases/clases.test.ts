import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { crearApp } from '../../app';
import { proximasClases } from '../../dominio/agenda';
import { prisma } from '../../db';
import {
  autorizacionDe,
  crearEscenarioBase,
  crearSocioDePrueba,
  vaciarBase,
} from '../../test/datosDePrueba';

const app = crearApp();
let escenario: Awaited<ReturnType<typeof crearEscenarioBase>>;

const LUNES = '2026-11-16';

// El token se firma en cada pedido: así sigue valiendo aunque un test adelante el reloj.
const como = (usuario: Parameters<typeof autorizacionDe>[0]) => ({
  get: (ruta: string) => request(app).get(ruta).set('Authorization', autorizacionDe(usuario)),
  post: (ruta: string, cuerpo: object = {}) =>
    request(app).post(ruta).set('Authorization', autorizacionDe(usuario)).send(cuerpo),
  delete: (ruta: string) => request(app).delete(ruta).set('Authorization', autorizacionDe(usuario)),
});

/** Socio del gimnasio A al día (pagó hasta fin de mes), listo para usar como "SOCIO". */
async function socioAlDia(dni: string, pagoHasta = '2026-11-30') {
  const { gimnasio, dueno } = escenario.gimnasioA;
  const socio = await crearSocioDePrueba(gimnasio, dueno.id, { dni, pagoHasta });
  return como({ id: socio.id, rol: 'SOCIO', gimnasioId: gimnasio.id });
}

async function crearClase(cupo = 10) {
  const respuesta = await como(escenario.gimnasioA.dueno).post('/api/clases', {
    nombre: 'Funcional',
    profesorId: escenario.gimnasioA.profesor.id,
    diaSemana: 1, // lunes
    horaInicio: '19:00',
    duracionMinutos: 60,
    cupo,
  });
  expect(respuesta.status).toBe(201);
  return respuesta.body.id as string;
}

beforeEach(async () => {
  await vaciarBase();
  escenario = await crearEscenarioBase();
  // Lunes 16/11/2026, 9:00 en Argentina.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-16T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('próximas clases (función pura)', () => {
  const clases = [
    { id: 'lunes-8', diaSemana: 1, horaInicio: '08:00' },
    { id: 'lunes-19', diaSemana: 1, horaInicio: '19:00' },
    { id: 'domingo-10', diaSemana: 7, horaInicio: '10:00' },
  ];

  it('muestra las de los próximos 7 días, sin las que ya empezaron', () => {
    const ahora = new Date('2026-11-16T12:00:00Z'); // lunes 9:00 en Argentina
    const resultado = proximasClases(clases, ahora).map((p) => `${p.clase.id} ${p.fecha}`);
    // La de las 8 de hoy ya pasó: aparece recién el lunes que viene… que cae fuera de los 7 días.
    expect(resultado).toEqual(['lunes-19 2026-11-16', 'domingo-10 2026-11-22']);
  });
});

describe('clases (personal)', () => {
  it('solo el dueño arma el cronograma; recepción y el profe lo ven', async () => {
    await crearClase();
    const { recepcion, profesor } = escenario.gimnasioA;

    const crearComoProfe = await como(profesor).post('/api/clases', { nombre: 'Yoga' });
    expect(crearComoProfe.status).toBe(403);
    expect((await como(recepcion).get('/api/clases')).body).toHaveLength(1);
  });

  it('la agenda del personal muestra quiénes se anotaron', async () => {
    const claseId = await crearClase();
    const socio = await socioAlDia('30000001');
    await socio.post(`/api/mi-cuenta/clases/${claseId}/inscripcion`, { fecha: LUNES });

    const agenda = await como(escenario.gimnasioA.profesor).get('/api/clases/agenda');
    expect(agenda.body[0]).toMatchObject({
      fecha: LUNES,
      inscriptos: 1,
      socios: [{ nombre: 'Juan', apellido: 'Pérez' }],
    });
  });
});

describe('inscripción del socio', () => {
  const anotarse = (
    socio: Awaited<ReturnType<typeof socioAlDia>>,
    claseId: string,
    fecha = LUNES,
  ) => socio.post(`/api/mi-cuenta/clases/${claseId}/inscripcion`, { fecha });

  it('se anota, ve que está anotado, y se da de baja', async () => {
    const claseId = await crearClase();
    const socio = await socioAlDia('30000001');

    expect((await anotarse(socio, claseId)).status).toBe(201);
    const agenda = await socio.get('/api/mi-cuenta/clases');
    expect(agenda.body[0]).toMatchObject({ anotado: true, inscriptos: 1 });
    // El socio NO ve los nombres de los demás.
    expect(agenda.body[0].socios).toBeUndefined();

    const baja = await socio.delete(`/api/mi-cuenta/clases/${claseId}/inscripcion?fecha=${LUNES}`);
    expect(baja.status).toBe(204);
    expect(await prisma.inscripcion.count()).toBe(0);
  });

  it('no se puede anotar dos veces ni pasarse del cupo', async () => {
    const claseId = await crearClase(1);
    const juan = await socioAlDia('30000001');
    const ana = await socioAlDia('30000002');

    expect((await anotarse(juan, claseId)).status).toBe(201);
    const repetida = await anotarse(juan, claseId);
    expect(repetida.status).toBe(409);
    const llena = await anotarse(ana, claseId);
    expect(llena.status).toBe(409);
  });

  it('con un solo lugar y dos socios a la vez, entra uno solo', async () => {
    const claseId = await crearClase(1);
    const juan = await socioAlDia('30000001');
    const ana = await socioAlDia('30000002');

    const resultados = await Promise.all([anotarse(juan, claseId), anotarse(ana, claseId)]);
    expect(resultados.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.inscripcion.count()).toBe(1);
  });

  it('no se puede anotar con la cuota vencida, ni en una fecha que no corresponde', async () => {
    const claseId = await crearClase();
    const deudor = await socioAlDia('30000001', '2026-10-31'); // el 16/11 ya pasó el día 10
    expect((await anotarse(deudor, claseId)).status).toBe(409);

    const socio = await socioAlDia('30000002');
    expect((await anotarse(socio, claseId, '2026-11-17')).status).toBe(400); // es martes
    expect((await anotarse(socio, claseId, '2026-11-23')).status).toBe(400); // fuera de los 7 días
  });

  it('no se puede dar de baja de una clase que ya empezó', async () => {
    const claseId = await crearClase();
    const socio = await socioAlDia('30000001');
    await anotarse(socio, claseId);

    vi.setSystemTime(new Date('2026-11-16T22:30:00Z')); // 19:30 en Argentina
    const baja = await socio.delete(`/api/mi-cuenta/clases/${claseId}/inscripcion?fecha=${LUNES}`);
    expect(baja.status).toBe(409);
  });
});
