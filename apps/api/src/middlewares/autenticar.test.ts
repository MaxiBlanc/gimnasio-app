import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { firmarTokenAcceso } from '../modulos/auth/tokens';
import { autenticar, obtenerGimnasioId, permitirRoles } from './autenticar';
import { manejarErrores } from './manejarErrores';

/**
 * Probamos los middlewares en una mini app con rutas de prueba, sin base de datos.
 * Así el test se enfoca solo en la regla de permisos.
 */
const app = express();
app.get('/solo-dueno', autenticar, permitirRoles('DUENO'), (_req, res) => {
  res.json({ ok: true });
});
app.get('/staff', autenticar, permitirRoles('DUENO', 'RECEPCION'), (_req, res) => {
  res.json({ ok: true });
});
app.get('/mi-gimnasio', autenticar, (req, res) => {
  res.json({ gimnasioId: obtenerGimnasioId(req) });
});
app.use(manejarErrores);

const GIMNASIO = '0195e4c8-0000-7000-8000-000000000001';
const token = (
  rol: Parameters<typeof firmarTokenAcceso>[0]['roles'][number],
  gimnasioId: string | null = GIMNASIO,
) =>
  `Bearer ${firmarTokenAcceso({ usuarioId: '0195e4c8-0000-7000-8000-0000000000aa', roles: [rol], gimnasioId })}`;

describe('permitirRoles', () => {
  it('deja pasar al rol permitido', async () => {
    const respuesta = await request(app).get('/solo-dueno').set('Authorization', token('DUENO'));
    expect(respuesta.status).toBe(200);
  });

  it.each(['RECEPCION', 'PROFESOR', 'KIOSCO'] as const)(
    'rechaza con 403 al rol %s en una ruta solo para el dueño',
    async (rol) => {
      const respuesta = await request(app).get('/solo-dueno').set('Authorization', token(rol));
      expect(respuesta.status).toBe(403);
      expect(respuesta.body.error.codigo).toBe('SIN_PERMISO');
    },
  );

  it('acepta varios roles', async () => {
    const respuesta = await request(app).get('/staff').set('Authorization', token('RECEPCION'));
    expect(respuesta.status).toBe(200);
  });

  it('sin token responde 401 (no 403)', async () => {
    const respuesta = await request(app).get('/solo-dueno');
    expect(respuesta.status).toBe(401);
  });

  it('rechaza un header Authorization mal formado', async () => {
    const respuesta = await request(app).get('/solo-dueno').set('Authorization', 'Token abc');
    expect(respuesta.status).toBe(401);
  });
});

describe('obtenerGimnasioId', () => {
  it('devuelve el gimnasio que viene en el token', async () => {
    const respuesta = await request(app)
      .get('/mi-gimnasio')
      .set('Authorization', token('RECEPCION'));
    expect(respuesta.body).toEqual({ gimnasioId: GIMNASIO });
  });

  it('el súper-admin (sin gimnasio) no puede usar rutas de un gimnasio', async () => {
    const respuesta = await request(app)
      .get('/mi-gimnasio')
      .set('Authorization', token('SUPERADMIN', null));
    expect(respuesta.status).toBe(403);
  });
});
