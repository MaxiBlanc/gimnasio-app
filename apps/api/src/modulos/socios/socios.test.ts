import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { DatosCrearSocio } from '@gimnasio/compartido';
import { crearApp } from '../../app';
import { prisma } from '../../db';
import { autorizacionDe, crearEscenarioBase, vaciarBase } from '../../test/datosDePrueba';
import { bandejaDePrueba } from '../correo/correo';

const app = crearApp();
let escenario: Awaited<ReturnType<typeof crearEscenarioBase>>;
let recepcionA: string;
let planA: { id: string };
let planInactivoA: { id: string };
let descuentoA: { id: string };
let planB: { id: string };

beforeEach(async () => {
  await vaciarBase();
  bandejaDePrueba.vaciar();
  escenario = await crearEscenarioBase();
  recepcionA = autorizacionDe(escenario.gimnasioA.recepcion);

  const idA = escenario.gimnasioA.gimnasio.id;
  const idB = escenario.gimnasioB.gimnasio.id;
  planA = await prisma.plan.create({
    data: { gimnasioId: idA, nombre: 'Mensual', precio: 30000, duracionMeses: 1 },
  });
  planInactivoA = await prisma.plan.create({
    data: { gimnasioId: idA, nombre: 'Viejo', precio: 1000, duracionMeses: 1, activo: false },
  });
  descuentoA = await prisma.descuento.create({
    data: { gimnasioId: idA, nombre: 'Estudiante', tipo: 'PORCENTAJE', valor: 10 },
  });
  planB = await prisma.plan.create({
    data: { gimnasioId: idB, nombre: 'Mensual', precio: 28000, duracionMeses: 1 },
  });
});

const socioJuan = (): DatosCrearSocio => ({
  nombre: 'Juan',
  apellido: 'Pérez',
  dni: '30.111.222',
  telefono: '11 5555-1222',
  email: 'Juan.Perez@Mail.com',
  emergenciaNombre: 'Ana Pérez',
  emergenciaTelefono: '11 4444-1222',
  planId: planA.id,
});

const crearSocio = (autorizacion: string, datos: object) =>
  request(app).post('/api/socios').set('Authorization', autorizacion).send(datos);

describe('Alta de socios', () => {
  it('crea el socio, normaliza DNI y email, y manda el mail de activación', async () => {
    const respuesta = await crearSocio(recepcionA, { ...socioJuan(), descuentoId: descuentoA.id });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.correoEnviado).toBe(true);
    expect(respuesta.body.socio).toMatchObject({
      dni: '30111222',
      email: 'juan.perez@mail.com',
      cuentaActivada: false,
      activo: true,
      plan: { nombre: 'Mensual' },
      descuento: { nombre: 'Estudiante' },
    });
    expect(JSON.stringify(respuesta.body)).not.toContain('hash');

    expect(bandejaDePrueba.correos).toHaveLength(1);
    const [correo] = bandejaDePrueba.correos;
    expect(correo!.para).toBe('juan.perez@mail.com');
    expect(correo!.asunto).toContain('Gimnasio A');
    expect(correo!.texto).toMatch(/http:\/\/web\.test\/g\/gimnasio-a\/activar\?token=[\w-]+/);
  });

  it('si el mail falla, el socio se crea igual e informa correoEnviado: false', async () => {
    bandejaDePrueba.fallar = true;
    const respuesta = await crearSocio(recepcionA, socioJuan());

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.correoEnviado).toBe(false);
    expect(await prisma.socio.count()).toBe(1);
  });

  it('rechaza un DNI repetido en el mismo gimnasio, aunque tenga puntos', async () => {
    await crearSocio(recepcionA, socioJuan());
    const respuesta = await crearSocio(recepcionA, { ...socioJuan(), dni: '30111222' });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.mensaje).toContain('Juan Pérez');
  });

  it('el mismo DNI puede ser socio de otro gimnasio', async () => {
    await crearSocio(recepcionA, socioJuan());
    const respuesta = await crearSocio(autorizacionDe(escenario.gimnasioB.recepcion), {
      ...socioJuan(),
      planId: planB.id,
    });
    expect(respuesta.status).toBe(201);
  });

  it('no permite asignar un plan de otro gimnasio ni un plan desactivado', async () => {
    const planAjeno = await crearSocio(recepcionA, { ...socioJuan(), planId: planB.id });
    const planViejo = await crearSocio(recepcionA, { ...socioJuan(), planId: planInactivoA.id });

    expect(planAjeno.status).toBe(400);
    expect(planAjeno.body.error.codigo).toBe('PLAN_INVALIDO');
    expect(planViejo.status).toBe(400);
    expect(await prisma.socio.count()).toBe(0);
  });

  it('valida todos los campos obligatorios', async () => {
    const respuesta = await crearSocio(recepcionA, { dni: '123', email: 'x' });
    const campos = respuesta.body.error.campos.map((c: { campo: string }) => c.campo);

    expect(respuesta.status).toBe(400);
    expect(campos).toEqual(
      expect.arrayContaining([
        'nombre',
        'apellido',
        'dni',
        'telefono',
        'email',
        'emergenciaNombre',
        'emergenciaTelefono',
        'planId',
      ]),
    );
  });
});

describe('Permisos', () => {
  it('el profesor puede ver socios pero no crearlos', async () => {
    const profe = autorizacionDe(escenario.gimnasioA.profesor);
    expect((await request(app).get('/api/socios').set('Authorization', profe)).status).toBe(200);
    expect((await crearSocio(profe, socioJuan())).status).toBe(403);
  });

  it('la pantalla de ingreso no puede ver la lista de socios', async () => {
    const kiosco = autorizacionDe(escenario.gimnasioA.kiosco);
    expect((await request(app).get('/api/socios').set('Authorization', kiosco)).status).toBe(403);
  });

  it('no se puede ver ni editar un socio de otro gimnasio', async () => {
    const { body } = await crearSocio(recepcionA, socioJuan());
    const recepcionB = autorizacionDe(escenario.gimnasioB.recepcion);

    const ver = await request(app)
      .get(`/api/socios/${body.socio.id}`)
      .set('Authorization', recepcionB);
    const editar = await request(app)
      .patch(`/api/socios/${body.socio.id}`)
      .set('Authorization', recepcionB)
      .send({ telefono: '0000000' });

    expect(ver.status).toBe(404);
    expect(editar.status).toBe(404);
  });
});

describe('Listado y búsqueda', () => {
  beforeEach(async () => {
    const personas = [
      ['Juan', 'Pérez', '30111222'],
      ['María', 'Gómez', '32444555'],
      ['Juana', 'López', '28999000'],
      ['Carlos', 'Pereyra', '35666777'],
    ];
    for (const [nombre, apellido, dni] of personas) {
      await crearSocio(recepcionA, { ...socioJuan(), nombre, apellido, dni });
    }
  });

  const listar = (consulta = '') =>
    request(app).get(`/api/socios${consulta}`).set('Authorization', recepcionA);
  const apellidos = (respuesta: request.Response) =>
    respuesta.body.datos.map((s: { apellido: string }) => s.apellido);

  it('lista ordenado por apellido, con el total', async () => {
    const respuesta = await listar();
    expect(apellidos(respuesta)).toEqual(['Gómez', 'López', 'Pereyra', 'Pérez']);
    expect(respuesta.body.total).toBe(4);
  });

  it('busca por nombre, apellido o DNI, y combina palabras', async () => {
    expect(apellidos(await listar('?busqueda=juan'))).toEqual(['López', 'Pérez']);
    expect(apellidos(await listar('?busqueda=juan%20lop'))).toEqual(['López']);
    expect(apellidos(await listar('?busqueda=32.444'))).toEqual(['Gómez']);
    expect(apellidos(await listar('?busqueda=PEREY'))).toEqual(['Pereyra']);
  });

  it('ignora acentos en los dos sentidos: "perez" encuentra "Pérez" y "lópez" encuentra "López"', async () => {
    expect(apellidos(await listar('?busqueda=perez'))).toEqual(['Pérez']);
    expect(apellidos(await listar('?busqueda=l%C3%B3pez'))).toEqual(['López']); // "lópez"
    expect(apellidos(await listar('?busqueda=GOMEZ'))).toEqual(['Gómez']);
  });

  it('pagina los resultados', async () => {
    const respuesta = await listar('?porPagina=3&pagina=2');
    expect(apellidos(respuesta)).toEqual(['Pérez']);
    expect(respuesta.body).toMatchObject({ total: 4, pagina: 2, porPagina: 3 });
  });

  it('los dados de baja no aparecen salvo que se pidan', async () => {
    const socio = await prisma.socio.findFirstOrThrow({ where: { apellido: 'Gómez' } });
    await request(app)
      .patch(`/api/socios/${socio.id}`)
      .set('Authorization', recepcionA)
      .send({ activo: false });

    expect(apellidos(await listar())).not.toContain('Gómez');
    expect(apellidos(await listar('?incluirBajas=true'))).toContain('Gómez');
  });

  it('otro gimnasio no ve estos socios', async () => {
    const respuesta = await request(app)
      .get('/api/socios')
      .set('Authorization', autorizacionDe(escenario.gimnasioB.dueno));
    expect(respuesta.body.total).toBe(0);
  });
});

describe('Edición', () => {
  it('edita datos y cambia de plan', async () => {
    const { body } = await crearSocio(recepcionA, socioJuan());
    const otroPlan = await prisma.plan.create({
      data: {
        gimnasioId: escenario.gimnasioA.gimnasio.id,
        nombre: 'Trimestral',
        precio: 81000,
        duracionMeses: 3,
      },
    });

    const respuesta = await request(app)
      .patch(`/api/socios/${body.socio.id}`)
      .set('Authorization', recepcionA)
      .send({ telefono: '11 6666-0000', planId: otroPlan.id, descuentoId: descuentoA.id });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({
      telefono: '11 6666-0000',
      plan: { nombre: 'Trimestral' },
      descuento: { nombre: 'Estudiante' },
    });
  });

  it('quita el descuento con descuentoId: null', async () => {
    const { body } = await crearSocio(recepcionA, { ...socioJuan(), descuentoId: descuentoA.id });
    const respuesta = await request(app)
      .patch(`/api/socios/${body.socio.id}`)
      .set('Authorization', recepcionA)
      .send({ descuentoId: null });
    expect(respuesta.body.descuento).toBeNull();
  });
});
