import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { crearApp } from '../../app';
import { autorizacionDe, crearEscenarioBase, vaciarBase } from '../../test/datosDePrueba';

const app = crearApp();
let escenario: Awaited<ReturnType<typeof crearEscenarioBase>>;
let duenoA: string;

beforeEach(async () => {
  await vaciarBase();
  escenario = await crearEscenarioBase();
  duenoA = autorizacionDe(escenario.gimnasioA.dueno);
});

const editar = (datos: object, autorizacion = duenoA) =>
  request(app).patch('/api/mi-gimnasio').set('Authorization', autorizacion).send(datos);

describe('Configuración del gimnasio', () => {
  it('todo el personal puede leerla, con los valores por defecto', async () => {
    const respuesta = await request(app)
      .get('/api/mi-gimnasio')
      .set('Authorization', autorizacionDe(escenario.gimnasioA.kiosco));

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({
      slug: 'gimnasio-a',
      diaCierreCobro: 10,
      diasAvisoVencimiento: 5,
      minutosPermanencia: 90,
      capacidadMaxima: null,
    });
  });

  it('el dueño la modifica, y solo cambia SU gimnasio', async () => {
    const respuesta = await editar({
      diaCierreCobro: 15,
      colorPrimario: '#ff0000',
      capacidadMaxima: 60,
      logoUrl: 'https://ejemplo.com/logo.png',
    });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({
      diaCierreCobro: 15,
      colorPrimario: '#FF0000',
      capacidadMaxima: 60,
    });

    const otro = await request(app)
      .get('/api/mi-gimnasio')
      .set('Authorization', autorizacionDe(escenario.gimnasioB.dueno));
    expect(otro.body.diaCierreCobro).toBe(10);
  });

  it('recepción y profesor no pueden modificarla', async () => {
    expect(
      (await editar({ diaCierreCobro: 5 }, autorizacionDe(escenario.gimnasioA.recepcion))).status,
    ).toBe(403);
    expect(
      (await editar({ diaCierreCobro: 5 }, autorizacionDe(escenario.gimnasioA.profesor))).status,
    ).toBe(403);
  });

  it.each([
    ['día de cierre 31', { diaCierreCobro: 31 }, 'diaCierreCobro'],
    ['días de aviso negativos', { diasAvisoVencimiento: -1 }, 'diasAvisoVencimiento'],
    ['permanencia de 5 minutos', { minutosPermanencia: 5 }, 'minutosPermanencia'],
    ['capacidad 0', { capacidadMaxima: 0 }, 'capacidadMaxima'],
    ['logo sin https', { logoUrl: 'http://x.com/a.png' }, 'logoUrl'],
  ])('rechaza %s', async (_caso, datos, campo) => {
    const respuesta = await editar(datos);
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.campos[0].campo).toBe(campo);
  });

  it('el slug y el nombre no se pueden cambiar desde acá (los ignora)', async () => {
    const respuesta = await editar({ slug: 'otro', nombre: 'Otro', diaCierreCobro: 12 });
    expect(respuesta.body).toMatchObject({
      slug: 'gimnasio-a',
      nombre: 'Gimnasio A',
      diaCierreCobro: 12,
    });
  });

  it('se puede quitar la capacidad máxima', async () => {
    await editar({ capacidadMaxima: 50 });
    expect((await editar({ capacidadMaxima: null })).body.capacidadMaxima).toBeNull();
  });
});
