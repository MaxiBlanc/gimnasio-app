import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { crearApp } from '../../app';
import { prisma } from '../../db';
import {
  autorizacionDe,
  CONTRASENA_PRUEBA,
  crearEscenarioBase,
  vaciarBase,
} from '../../test/datosDePrueba';

const app = crearApp();
let escenario: Awaited<ReturnType<typeof crearEscenarioBase>>;
let duenoA: string;

beforeEach(async () => {
  await vaciarBase();
  escenario = await crearEscenarioBase();
  duenoA = autorizacionDe(escenario.gimnasioA.dueno);
});

const nueva = {
  nombre: 'Carla Gómez',
  email: 'Carla@Gimnasio-A.com',
  roles: ['RECEPCION', 'PROFESOR'],
  contrasena: 'Carla2026!',
};

const crear = (datos: object, autorizacion = duenoA) =>
  request(app).post('/api/personal').set('Authorization', autorizacion).send(datos);

const login = (email: string, contrasena: string) =>
  request(app).post('/api/auth/login').send({ gimnasio: 'gimnasio-a', email, contrasena });

describe('Personal del gimnasio', () => {
  it('el dueño da de alta a alguien con dos roles, que después puede entrar', async () => {
    const respuesta = await crear(nueva);
    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toMatchObject({
      email: 'carla@gimnasio-a.com', // normalizado
      roles: ['RECEPCION', 'PROFESOR'],
      activo: true,
      editable: true,
    });
    expect(JSON.stringify(respuesta.body)).not.toContain('hash');

    const sesion = await login('carla@gimnasio-a.com', 'Carla2026!');
    expect(sesion.status).toBe(200);
    expect(sesion.body.usuario.roles).toEqual(['RECEPCION', 'PROFESOR']);
  });

  it('con recepción + profe puede hacer lo de los dos (y nada más)', async () => {
    const { body } = await crear(nueva);
    const carla = autorizacionDe({
      id: body.id,
      roles: body.roles,
      gimnasioId: escenario.gimnasioA.gimnasio.id,
    });
    const ver = (ruta: string) => request(app).get(ruta).set('Authorization', carla);

    expect((await ver('/api/planes')).status).toBe(200); // de recepción
    expect((await ver('/api/rutinas/plantillas')).status).toBe(200); // de profe
    expect((await ver('/api/tablero')).status).toBe(403); // del dueño
    expect((await ver('/api/personal')).status).toBe(403);
  });

  it('la pantalla de ingreso no se combina con otros roles', async () => {
    const respuesta = await crear({ ...nueva, roles: ['KIOSCO', 'RECEPCION'] });
    expect(respuesta.status).toBe(400);
  });

  it('no deja crear dueños ni súper-admins, ni repetir un email', async () => {
    expect((await crear({ ...nueva, roles: ['DUENO'] })).status).toBe(400);
    expect((await crear({ ...nueva, roles: ['SUPERADMIN'] })).status).toBe(400);
    const repetido = await crear({ ...nueva, email: 'profe@gimnasio-a.com' });
    expect(repetido.status).toBe(409);
    expect(repetido.body.error.codigo).toBe('EMAIL_EN_USO');
  });

  it('solo el dueño, y solo ve a los de su gimnasio', async () => {
    const recepcion = autorizacionDe(escenario.gimnasioA.recepcion);
    expect((await crear(nueva, recepcion)).status).toBe(403);

    const lista = await request(app).get('/api/personal').set('Authorization', duenoA);
    expect(lista.status).toBe(200);
    expect(lista.body.map((p: { email: string }) => p.email).sort()).toEqual([
      'dueno@gimnasio-a.com',
      'ingreso@gimnasio-a.com',
      'profe@gimnasio-a.com',
      'recepcion@gimnasio-a.com',
    ]);
    // El dueño aparece, pero no editable.
    expect(
      lista.body.find((p: { email: string }) => p.email === 'dueno@gimnasio-a.com').editable,
    ).toBe(false);

    // Editar a alguien de otro gimnasio: como si no existiera.
    const ajeno = escenario.gimnasioB.profesor.id;
    const editar = await request(app)
      .put(`/api/personal/${ajeno}`)
      .set('Authorization', duenoA)
      .send({ nombre: 'Ajeno', email: 'x@x.com', roles: ['PROFESOR'], activo: true });
    expect(editar.status).toBe(404);
  });

  it('no se puede editar al dueño desde acá', async () => {
    const respuesta = await request(app)
      .put(`/api/personal/${escenario.gimnasioA.dueno.id}`)
      .set('Authorization', duenoA)
      .send({ nombre: 'Otro', email: 'dueno@gimnasio-a.com', roles: ['RECEPCION'], activo: true });
    expect(respuesta.status).toBe(403);
  });

  it('desactivar o cambiar roles cierra sus sesiones; editar el nombre no', async () => {
    const profe = escenario.gimnasioA.profesor;
    const base = { nombre: profe.nombre, email: profe.email, roles: ['PROFESOR'], activo: true };
    const editar = (datos: object) =>
      request(app).put(`/api/personal/${profe.id}`).set('Authorization', duenoA).send(datos);
    const sesionesAbiertas = () =>
      prisma.sesion.count({ where: { usuarioId: profe.id, revocadaEn: null } });

    await login(profe.email, CONTRASENA_PRUEBA);
    expect(await sesionesAbiertas()).toBe(1);

    expect((await editar({ ...base, nombre: 'Pablo P.' })).status).toBe(200);
    expect(await sesionesAbiertas()).toBe(1);

    expect((await editar({ ...base, roles: ['PROFESOR', 'RECEPCION'] })).status).toBe(200);
    expect(await sesionesAbiertas()).toBe(0);

    await login(profe.email, CONTRASENA_PRUEBA);
    const baja = await editar({ ...base, activo: false });
    expect(baja.body.activo).toBe(false);
    expect(await sesionesAbiertas()).toBe(0);
    expect((await login(profe.email, CONTRASENA_PRUEBA)).status).toBe(401);
  });

  it('cambia la contraseña solo si se manda una', async () => {
    const profe = escenario.gimnasioA.profesor;
    const base = { nombre: profe.nombre, email: profe.email, roles: ['PROFESOR'], activo: true };
    const editar = (datos: object) =>
      request(app).put(`/api/personal/${profe.id}`).set('Authorization', duenoA).send(datos);

    await editar({ ...base, contrasena: '' });
    expect((await login(profe.email, CONTRASENA_PRUEBA)).status).toBe(200);

    await editar({ ...base, contrasena: 'NuevaClave99' });
    expect((await login(profe.email, CONTRASENA_PRUEBA)).status).toBe(401);
    expect((await login(profe.email, 'NuevaClave99')).status).toBe(200);
  });
});
