import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { crearApp } from '../../app';
import { autorizacionDe, crearEscenarioBase, vaciarBase } from '../../test/datosDePrueba';

const app = crearApp();
let escenario: Awaited<ReturnType<typeof crearEscenarioBase>>;
let duenoA: string;
let duenoB: string;

beforeEach(async () => {
  await vaciarBase();
  escenario = await crearEscenarioBase();
  duenoA = autorizacionDe(escenario.gimnasioA.dueno);
  duenoB = autorizacionDe(escenario.gimnasioB.dueno);
});

const crearDescuento = (autorizacion: string, datos: object) =>
  request(app).post('/api/descuentos').set('Authorization', autorizacion).send(datos);

const editarDescuento = (autorizacion: string, id: string, datos: object) =>
  request(app).patch(`/api/descuentos/${id}`).set('Authorization', autorizacion).send(datos);

const estudiante = { nombre: 'Estudiante', tipo: 'PORCENTAJE', valor: 10 };

describe('Descuentos', () => {
  it('crea descuentos por porcentaje y por monto fijo', async () => {
    const porcentaje = await crearDescuento(duenoA, estudiante);
    const fijo = await crearDescuento(duenoA, {
      nombre: 'Promo amigos',
      tipo: 'MONTO_FIJO',
      valor: 5000,
    });

    expect(porcentaje.status).toBe(201);
    expect(porcentaje.body).toMatchObject({ tipo: 'PORCENTAJE', valor: 10, activo: true });
    expect(fijo.status).toBe(201);
    expect(fijo.body).toMatchObject({ tipo: 'MONTO_FIJO', valor: 5000 });
  });

  it('rechaza un porcentaje mayor a 100, marcando el campo valor', async () => {
    const respuesta = await crearDescuento(duenoA, { ...estudiante, valor: 150 });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.campos).toContainEqual({
      campo: 'valor',
      mensaje: 'Un porcentaje no puede superar 100',
    });
  });

  it('rechaza un valor 0 y un tipo desconocido', async () => {
    expect((await crearDescuento(duenoA, { ...estudiante, valor: 0 })).status).toBe(400);
    expect((await crearDescuento(duenoA, { ...estudiante, tipo: 'REGALO' })).status).toBe(400);
  });

  it('al editar, valida el tipo nuevo contra el valor ya guardado', async () => {
    const { body: fijo } = await crearDescuento(duenoA, {
      nombre: 'Promo amigos',
      tipo: 'MONTO_FIJO',
      valor: 5000,
    });

    // Pasar a PORCENTAJE sin cambiar el valor daría un descuento del 5000 %.
    const soloTipo = await editarDescuento(duenoA, fijo.id, { tipo: 'PORCENTAJE' });
    expect(soloTipo.status).toBe(400);
    expect(soloTipo.body.error.codigo).toBe('VALOR_INVALIDO');

    const tipoYValor = await editarDescuento(duenoA, fijo.id, { tipo: 'PORCENTAJE', valor: 15 });
    expect(tipoYValor.status).toBe(200);
    expect(tipoYValor.body).toMatchObject({ tipo: 'PORCENTAJE', valor: 15 });
  });

  it('cada gimnasio ve y edita solo sus descuentos', async () => {
    const { body: deB } = await crearDescuento(duenoB, estudiante);
    await crearDescuento(duenoA, { nombre: 'Jubilado', tipo: 'PORCENTAJE', valor: 15 });

    const lista = await request(app).get('/api/descuentos').set('Authorization', duenoA);
    expect(lista.body.map((d: { nombre: string }) => d.nombre)).toEqual(['Jubilado']);

    expect((await editarDescuento(duenoA, deB.id, { valor: 99 })).status).toBe(404);
  });

  it('recepción puede verlos pero no crearlos', async () => {
    const recepcion = autorizacionDe(escenario.gimnasioA.recepcion);
    expect((await request(app).get('/api/descuentos').set('Authorization', recepcion)).status).toBe(
      200,
    );
    expect((await crearDescuento(recepcion, estudiante)).status).toBe(403);
  });
});
