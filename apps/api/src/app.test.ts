import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { crearApp } from './app';

describe('API base', () => {
  const app = crearApp();

  it('GET /api/salud responde ok', async () => {
    const respuesta = await request(app).get('/api/salud');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ estado: 'ok', app: 'GimnasioApp' });
  });

  it('una ruta inexistente responde 404 con el formato de error estándar', async () => {
    const respuesta = await request(app).get('/api/no-existe');

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.codigo).toBe('NO_ENCONTRADO');
  });
});
