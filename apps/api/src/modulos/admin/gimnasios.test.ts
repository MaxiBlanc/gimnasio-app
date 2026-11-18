import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { DatosCrearGimnasio } from '@gimnasio/compartido';
import { crearApp } from '../../app';
import { prisma } from '../../db';
import { autorizacionDe, crearEscenarioBase, vaciarBase } from '../../test/datosDePrueba';

const app = crearApp();
let escenario: Awaited<ReturnType<typeof crearEscenarioBase>>;
let comoAdmin: string;

beforeEach(async () => {
  await vaciarBase();
  escenario = await crearEscenarioBase();
  comoAdmin = autorizacionDe(escenario.superadmin);
});

const nuevoGimnasio: DatosCrearGimnasio = {
  gimnasio: { nombre: 'Iron Box', slug: 'iron-box', colorPrimario: '#00ff88' },
  dueno: { nombre: 'Pedro Iron', email: 'Pedro@IronBox.com', contrasena: 'IronBox2026' },
};

describe('Permisos del panel de súper-admin', () => {
  it('sin token responde 401', async () => {
    expect((await request(app).get('/api/admin/gimnasios')).status).toBe(401);
  });

  it.each(['dueno', 'recepcion', 'profesor', 'kiosco'] as const)(
    'el %s de un gimnasio recibe 403 en todas las rutas',
    async (rol) => {
      const comoStaff = autorizacionDe(escenario.gimnasioA[rol]);
      const id = escenario.gimnasioB.gimnasio.id;

      const respuestas = await Promise.all([
        request(app).get('/api/admin/gimnasios').set('Authorization', comoStaff),
        request(app).get(`/api/admin/gimnasios/${id}`).set('Authorization', comoStaff),
        request(app)
          .post('/api/admin/gimnasios')
          .set('Authorization', comoStaff)
          .send(nuevoGimnasio),
        request(app)
          .patch(`/api/admin/gimnasios/${id}`)
          .set('Authorization', comoStaff)
          .send({ activo: false }),
      ]);
      expect(respuestas.map((r) => r.status)).toEqual([403, 403, 403, 403]);
    },
  );
});

describe('GET /api/admin/gimnasios', () => {
  it('lista todos los gimnasios con la cantidad de usuarios y socios', async () => {
    const respuesta = await request(app)
      .get('/api/admin/gimnasios')
      .set('Authorization', comoAdmin);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toHaveLength(2);
    expect(respuesta.body[0]).toMatchObject({
      slug: 'gimnasio-a',
      activo: true,
      cantidadUsuarios: 4,
      cantidadSocios: 0,
    });
  });
});

describe('POST /api/admin/gimnasios', () => {
  it('crea el gimnasio y su dueño, y el dueño puede iniciar sesión', async () => {
    const respuesta = await request(app)
      .post('/api/admin/gimnasios')
      .set('Authorization', comoAdmin)
      .send(nuevoGimnasio);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toMatchObject({
      nombre: 'Iron Box',
      slug: 'iron-box',
      colorPrimario: '#00FF88', // normalizado a mayúsculas
      usuarios: [{ nombre: 'Pedro Iron', email: 'pedro@ironbox.com', roles: ['DUENO'] }],
    });

    const login = await request(app)
      .post('/api/auth/login')
      .send({ gimnasio: 'iron-box', email: 'pedro@ironbox.com', contrasena: 'IronBox2026' });
    expect(login.status).toBe(200);
    expect(login.body.usuario.roles).toEqual(['DUENO']);
  });

  it('rechaza un slug que ya existe con 409, sin crear nada', async () => {
    const repetido = { ...nuevoGimnasio, gimnasio: { nombre: 'Otro', slug: 'gimnasio-a' } };
    const respuesta = await request(app)
      .post('/api/admin/gimnasios')
      .set('Authorization', comoAdmin)
      .send(repetido);

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.codigo).toBe('SLUG_EN_USO');
    expect(await prisma.gimnasio.count()).toBe(2);
  });

  it('valida slug, color, logo y contraseña', async () => {
    const invalido = {
      gimnasio: {
        nombre: 'X',
        slug: 'Con Espacios!',
        colorPrimario: 'rojo',
        logoUrl: 'http://inseguro.com/logo.png',
      },
      dueno: { nombre: 'Pedro', email: 'pedro@ironbox.com', contrasena: '123' },
    };
    const respuesta = await request(app)
      .post('/api/admin/gimnasios')
      .set('Authorization', comoAdmin)
      .send(invalido);

    expect(respuesta.status).toBe(400);
    const campos = respuesta.body.error.campos.map((c: { campo: string }) => c.campo);
    expect(campos).toEqual(
      expect.arrayContaining([
        'gimnasio.nombre',
        'gimnasio.slug',
        'gimnasio.colorPrimario',
        'gimnasio.logoUrl',
        'dueno.contrasena',
      ]),
    );
  });
});

describe('PATCH /api/admin/gimnasios/:id', () => {
  it('edita los datos del gimnasio', async () => {
    const respuesta = await request(app)
      .patch(`/api/admin/gimnasios/${escenario.gimnasioA.gimnasio.id}`)
      .set('Authorization', comoAdmin)
      .send({ nombre: 'Gimnasio A Renovado', logoUrl: 'https://ejemplo.com/logo.png' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({
      nombre: 'Gimnasio A Renovado',
      logoUrl: 'https://ejemplo.com/logo.png',
      slug: 'gimnasio-a', // el slug no cambia
    });
  });

  it('suspender un gimnasio cierra las sesiones de su personal, y solo las de ese gimnasio', async () => {
    const login = (gimnasio: string, email: string) =>
      request(app).post('/api/auth/login').send({ gimnasio, email, contrasena: 'Clave1234' });
    const sesionA = await login('gimnasio-a', 'recepcion@gimnasio-a.com');
    const sesionB = await login('gimnasio-b', 'recepcion@gimnasio-b.com');

    const respuesta = await request(app)
      .patch(`/api/admin/gimnasios/${escenario.gimnasioA.gimnasio.id}`)
      .set('Authorization', comoAdmin)
      .send({ activo: false });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.activo).toBe(false);

    // Las sesiones del gimnasio A quedaron revocadas en la base; las del B, no.
    const sesionesAbiertas = (gimnasioId: string) =>
      prisma.sesion.count({ where: { revocadaEn: null, usuario: { gimnasioId } } });
    expect(await sesionesAbiertas(escenario.gimnasioA.gimnasio.id)).toBe(0);
    expect(await sesionesAbiertas(escenario.gimnasioB.gimnasio.id)).toBe(1);

    const refrescar = (sesion: request.Response) =>
      request(app)
        .post('/api/auth/refrescar')
        .set('Cookie', ([] as string[]).concat(sesion.headers['set-cookie'] ?? []));
    expect((await refrescar(sesionA)).status).toBe(401); // gimnasio suspendido
    expect((await refrescar(sesionB)).status).toBe(200); // el otro gimnasio sigue normal
  });

  it('un id inexistente responde 404 y un id mal formado 400', async () => {
    const inexistente = await request(app)
      .patch('/api/admin/gimnasios/0195e4c8-0000-7000-8000-000000000999')
      .set('Authorization', comoAdmin)
      .send({ nombre: 'Nada' });
    expect(inexistente.status).toBe(404);

    const malFormado = await request(app)
      .patch('/api/admin/gimnasios/123')
      .set('Authorization', comoAdmin)
      .send({ nombre: 'Nada' });
    expect(malFormado.status).toBe(400);
  });

  it('rechaza un cuerpo vacío', async () => {
    const respuesta = await request(app)
      .patch(`/api/admin/gimnasios/${escenario.gimnasioA.gimnasio.id}`)
      .set('Authorization', comoAdmin)
      .send({});
    expect(respuesta.status).toBe(400);
  });
});
