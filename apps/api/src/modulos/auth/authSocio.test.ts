import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { crearApp } from '../../app';
import { prisma } from '../../db';
import {
  CONTRASENA_PRUEBA,
  autorizacionDe,
  crearEscenarioBase,
  vaciarBase,
} from '../../test/datosDePrueba';

const app = crearApp();
let escenario: Awaited<ReturnType<typeof crearEscenarioBase>>;

/** Crea un socio en el gimnasio A. Con `activado`, ya tiene contraseña. */
async function crearSocio({ activado = true, activo = true, dni = '30111222' } = {}) {
  const { gimnasio } = escenario.gimnasioA;
  const plan = await prisma.plan.create({
    data: { gimnasioId: gimnasio.id, nombre: `Mensual ${dni}`, precio: 20000, duracionMeses: 1 },
  });
  return prisma.socio.create({
    data: {
      gimnasioId: gimnasio.id,
      nombre: 'Juan',
      apellido: 'Pérez',
      dni,
      telefono: '1155551234',
      email: 'juan@ejemplo.com',
      emergenciaNombre: 'Ana',
      emergenciaTelefono: '1155554321',
      planId: plan.id,
      activo,
      hashContrasena: activado ? await bcrypt.hash(CONTRASENA_PRUEBA, 4) : null,
    },
  });
}

const loginSocio = (dni: string, contrasena = CONTRASENA_PRUEBA, gimnasio = 'gimnasio-a') =>
  request(app).post('/api/auth/socio/login').send({ gimnasio, dni, contrasena });

/** Saca "token_refresco=..." de la respuesta. */
function cookieRefresco(respuesta: request.Response): string {
  const cookies = ([] as string[]).concat(respuesta.headers['set-cookie'] ?? []);
  const cookie = cookies.find((c) => c.startsWith('token_refresco='));
  if (!cookie) throw new Error('La respuesta no trae la cookie de refresco');
  return cookie.split(';')[0]!;
}

beforeEach(async () => {
  await vaciarBase();
  escenario = await crearEscenarioBase();
});

describe('POST /api/auth/socio/login', () => {
  it('entra con DNI (con o sin puntos) y contraseña, con rol SOCIO', async () => {
    await crearSocio();
    const respuesta = await loginSocio('30.111.222');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.usuario).toMatchObject({
      nombre: 'Juan Pérez',
      rol: 'SOCIO',
      gimnasio: { slug: 'gimnasio-a' },
    });
    expect(JSON.stringify(respuesta.body)).not.toContain('hash');
  });

  it('rechaza con el mismo error: contraseña mala, DNI inexistente, cuenta sin activar', async () => {
    await crearSocio();
    await crearSocio({ activado: false, dni: '30999888' });

    const respuestas = await Promise.all([
      loginSocio('30111222', 'otra'),
      loginSocio('11222333'),
      loginSocio('30999888'),
    ]);
    for (const r of respuestas) {
      expect(r.status).toBe(401);
      expect(r.body).toEqual(respuestas[0]!.body);
    }
  });

  it('no entra si está dado de baja o por otro gimnasio', async () => {
    await crearSocio({ activo: false });
    expect((await loginSocio('30111222')).status).toBe(401);
    expect((await loginSocio('30111222', CONTRASENA_PRUEBA, 'gimnasio-b')).status).toBe(401);
  });
});

describe('sesión del socio', () => {
  it('refresca la sesión y /yo devuelve al socio', async () => {
    await crearSocio();
    const login = await loginSocio('30111222');

    const refresco = await request(app)
      .post('/api/auth/refrescar')
      .set('Cookie', cookieRefresco(login));
    expect(refresco.status).toBe(200);
    expect(refresco.body.usuario.rol).toBe('SOCIO');

    const yo = await request(app)
      .get('/api/auth/yo')
      .set('Authorization', `Bearer ${refresco.body.tokenAcceso}`);
    expect(yo.status).toBe(200);
    expect(yo.body).toMatchObject({ nombre: 'Juan Pérez', rol: 'SOCIO' });
  });

  it('si lo dan de baja, no puede refrescar la sesión', async () => {
    const socio = await crearSocio();
    const login = await loginSocio('30111222');
    await prisma.socio.update({ where: { id: socio.id }, data: { activo: false } });

    const refresco = await request(app)
      .post('/api/auth/refrescar')
      .set('Cookie', cookieRefresco(login));
    expect(refresco.status).toBe(401);
  });

  it('un socio NO puede usar las rutas del panel', async () => {
    const socio = await crearSocio();
    const token = autorizacionDe({
      id: socio.id,
      rol: 'SOCIO',
      gimnasioId: escenario.gimnasioA.gimnasio.id,
    });

    for (const ruta of ['/api/socios', '/api/planes', '/api/mi-gimnasio']) {
      const respuesta = await request(app).get(ruta).set('Authorization', token);
      expect(respuesta.status).toBe(403);
    }
  });
});
