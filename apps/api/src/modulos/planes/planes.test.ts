import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { crearApp } from '../../app';
import { prisma } from '../../db';
import { autorizacionDe, crearEscenarioBase, vaciarBase } from '../../test/datosDePrueba';

const app = crearApp();
let escenario: Awaited<ReturnType<typeof crearEscenarioBase>>;
let duenoA: string;
let recepcionA: string;
let duenoB: string;

beforeEach(async () => {
  await vaciarBase();
  escenario = await crearEscenarioBase();
  duenoA = autorizacionDe(escenario.gimnasioA.dueno);
  recepcionA = autorizacionDe(escenario.gimnasioA.recepcion);
  duenoB = autorizacionDe(escenario.gimnasioB.dueno);
});

const crearPlan = (autorizacion: string, datos: object) =>
  request(app).post('/api/planes').set('Authorization', autorizacion).send(datos);

const mensual = { nombre: 'Mensual', precio: 30000, duracionMeses: 1 };

describe('Permisos sobre planes', () => {
  it('recepción puede ver los planes pero no crearlos ni editarlos', async () => {
    const { body: plan } = await crearPlan(duenoA, mensual);

    expect((await request(app).get('/api/planes').set('Authorization', recepcionA)).status).toBe(
      200,
    );
    expect((await crearPlan(recepcionA, { ...mensual, nombre: 'Otro' })).status).toBe(403);
    const edicion = await request(app)
      .patch(`/api/planes/${plan.id}`)
      .set('Authorization', recepcionA)
      .send({ precio: 1 });
    expect(edicion.status).toBe(403);
  });

  it.each(['profesor', 'kiosco'] as const)('el rol %s no puede ver los planes', async (rol) => {
    const respuesta = await request(app)
      .get('/api/planes')
      .set('Authorization', autorizacionDe(escenario.gimnasioA[rol]));
    expect(respuesta.status).toBe(403);
  });

  it('el súper-admin no opera planes de un gimnasio', async () => {
    const respuesta = await request(app)
      .get('/api/planes')
      .set('Authorization', autorizacionDe(escenario.superadmin));
    expect(respuesta.status).toBe(403);
  });
});

describe('Aislamiento entre gimnasios', () => {
  it('cada gimnasio ve solo sus planes', async () => {
    await crearPlan(duenoA, mensual);
    await crearPlan(duenoB, { nombre: 'Pase libre', precio: 25000, duracionMeses: 1 });

    const respuesta = await request(app).get('/api/planes').set('Authorization', duenoA);
    expect(respuesta.body.map((p: { nombre: string }) => p.nombre)).toEqual(['Mensual']);
  });

  it('dos gimnasios pueden tener un plan con el mismo nombre', async () => {
    expect((await crearPlan(duenoA, mensual)).status).toBe(201);
    expect((await crearPlan(duenoB, mensual)).status).toBe(201);
  });

  it('el dueño de A NO puede editar un plan de B: responde 404 y no lo modifica', async () => {
    const { body: planB } = await crearPlan(duenoB, mensual);

    const respuesta = await request(app)
      .patch(`/api/planes/${planB.id}`)
      .set('Authorization', duenoA)
      .send({ precio: 1 });

    expect(respuesta.status).toBe(404);
    const enBase = await prisma.plan.findUniqueOrThrow({ where: { id: planB.id } });
    expect(enBase.precio.toNumber()).toBe(30000);
  });
});

describe('Alta y edición de planes', () => {
  it('crea un plan y devuelve el precio como número', async () => {
    const respuesta = await crearPlan(duenoA, {
      nombre: 'Trimestral',
      precio: 81000.5,
      duracionMeses: 3,
    });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toMatchObject({
      nombre: 'Trimestral',
      precio: 81000.5,
      duracionMeses: 3,
      activo: true,
      cantidadSocios: 0,
    });
  });

  it('rechaza nombres repetidos sin importar mayúsculas', async () => {
    await crearPlan(duenoA, mensual);
    const respuesta = await crearPlan(duenoA, { ...mensual, nombre: 'MENSUAL' });
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.codigo).toBe('NOMBRE_EN_USO');
  });

  it.each([
    ['precio negativo', { precio: -1 }, 'precio'],
    ['más de 2 decimales', { precio: 100.123 }, 'precio'],
    ['precio como texto', { precio: '30000' }, 'precio'],
    ['duración 0', { duracionMeses: 0 }, 'duracionMeses'],
    ['duración con decimales', { duracionMeses: 1.5 }, 'duracionMeses'],
    ['nombre vacío', { nombre: ' ' }, 'nombre'],
  ])('rechaza %s', async (_caso, cambio, campo) => {
    const respuesta = await crearPlan(duenoA, { ...mensual, ...cambio });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.campos[0].campo).toBe(campo);
  });

  it('edita el precio y desactiva el plan', async () => {
    const { body: plan } = await crearPlan(duenoA, mensual);

    const respuesta = await request(app)
      .patch(`/api/planes/${plan.id}`)
      .set('Authorization', duenoA)
      .send({ precio: 35000, activo: false });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({ precio: 35000, activo: false });
  });

  it('al renombrar, puede conservar su propio nombre pero no tomar el de otro plan', async () => {
    const { body: plan } = await crearPlan(duenoA, mensual);
    await crearPlan(duenoA, { nombre: 'Anual', precio: 300000, duracionMeses: 12 });

    const mismoNombre = await request(app)
      .patch(`/api/planes/${plan.id}`)
      .set('Authorization', duenoA)
      .send({ nombre: 'Mensual', precio: 32000 });
    expect(mismoNombre.status).toBe(200);

    const nombreAjeno = await request(app)
      .patch(`/api/planes/${plan.id}`)
      .set('Authorization', duenoA)
      .send({ nombre: 'anual' });
    expect(nombreAjeno.status).toBe(409);
  });
});
