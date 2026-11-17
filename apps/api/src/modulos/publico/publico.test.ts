import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { crearApp } from '../../app';
import { prisma } from '../../db';
import { crearEscenarioBase, vaciarBase } from '../../test/datosDePrueba';

const app = crearApp();

beforeEach(async () => {
  await vaciarBase();
  await crearEscenarioBase();
});

describe('Marca pública de un gimnasio', () => {
  it('devuelve nombre, logo y colores sin pedir login', async () => {
    const respuesta = await request(app).get('/api/publico/gimnasios/gimnasio-a');
    expect(respuesta.status).toBe(200);
    expect(Object.keys(respuesta.body).sort()).toEqual(
      ['colorPrimario', 'colorSecundario', 'id', 'logoUrl', 'nombre', 'slug'].sort(),
    );
    expect(respuesta.body.slug).toBe('gimnasio-a');
  });

  it('acepta el slug con mayúsculas o espacios', async () => {
    const respuesta = await request(app).get('/api/publico/gimnasios/%20Gimnasio-A%20');
    expect(respuesta.status).toBe(200);
  });

  it('un gimnasio suspendido o inexistente da 404', async () => {
    await prisma.gimnasio.update({ where: { slug: 'gimnasio-a' }, data: { activo: false } });
    expect((await request(app).get('/api/publico/gimnasios/gimnasio-a')).status).toBe(404);
    expect((await request(app).get('/api/publico/gimnasios/no-existe')).status).toBe(404);
  });

  it('un slug con formato inválido da 400', async () => {
    expect((await request(app).get('/api/publico/gimnasios/a')).status).toBe(400);
  });
});
