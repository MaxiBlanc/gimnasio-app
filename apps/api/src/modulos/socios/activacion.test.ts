import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { crearApp } from '../../app';
import { prisma } from '../../db';
import { autorizacionDe, crearEscenarioBase, vaciarBase } from '../../test/datosDePrueba';
import { bandejaDePrueba } from '../correo/correo';

const app = crearApp();
let escenario: Awaited<ReturnType<typeof crearEscenarioBase>>;
let recepcionA: string;
let socioId: string;

/** Saca el token del link que llegó en el último mail. */
function tokenDelUltimoCorreo(): string {
  const correo = bandejaDePrueba.correos.at(-1);
  const token = correo?.texto.match(/token=([\w-]+)/)?.[1];
  if (!token) throw new Error('No llegó ningún mail con token');
  return token;
}

const activar = (token: string, contrasena = 'MiClave123') =>
  request(app).post('/api/cuenta-socio/activar').send({ token, contrasena });

beforeEach(async () => {
  await vaciarBase();
  bandejaDePrueba.vaciar();
  escenario = await crearEscenarioBase();
  recepcionA = autorizacionDe(escenario.gimnasioA.recepcion);

  const plan = await prisma.plan.create({
    data: {
      gimnasioId: escenario.gimnasioA.gimnasio.id,
      nombre: 'Mensual',
      precio: 30000,
      duracionMeses: 1,
    },
  });
  const respuesta = await request(app).post('/api/socios').set('Authorization', recepcionA).send({
    nombre: 'Juan',
    apellido: 'Pérez',
    dni: '30111222',
    telefono: '1155551222',
    email: 'juan@mail.com',
    emergenciaNombre: 'Ana',
    emergenciaTelefono: '1144441222',
    planId: plan.id,
  });
  socioId = respuesta.body.socio.id;
});

describe('Activación de la cuenta del socio', () => {
  it('con el token del mail, el socio crea su contraseña', async () => {
    const respuesta = await activar(tokenDelUltimoCorreo());

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ gimnasio: 'gimnasio-a' });

    const socio = await prisma.socio.findUniqueOrThrow({ where: { id: socioId } });
    expect(socio.hashContrasena).not.toBeNull();
    expect(await bcrypt.compare('MiClave123', socio.hashContrasena!)).toBe(true);
  });

  it('el token sirve una sola vez', async () => {
    const token = tokenDelUltimoCorreo();
    await activar(token);

    const segundaVez = await activar(token, 'OtraClave999');
    expect(segundaVez.status).toBe(400);
    expect(segundaVez.body.error.codigo).toBe('ENLACE_INVALIDO');
  });

  it('un token inventado o vencido no sirve', async () => {
    expect((await activar('token-inventado-que-no-existe-en-la-base')).status).toBe(400);

    const token = tokenDelUltimoCorreo();
    await prisma.tokenSocio.updateMany({ data: { expiraEn: new Date(Date.now() - 1000) } });
    expect((await activar(token)).status).toBe(400);
  });

  it('si el socio fue dado de baja, el link deja de servir', async () => {
    const token = tokenDelUltimoCorreo();
    await prisma.socio.update({ where: { id: socioId }, data: { activo: false } });
    expect((await activar(token)).status).toBe(400);
  });

  it('exige una contraseña de al menos 8 caracteres', async () => {
    const respuesta = await activar(tokenDelUltimoCorreo(), '123');
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.campos[0].campo).toBe('contrasena');
  });

  it('la base guarda el hash del token, no el token', async () => {
    const token = tokenDelUltimoCorreo();
    const enBase = await prisma.tokenSocio.findFirstOrThrow();
    expect(enBase.hashToken).not.toBe(token);
  });
});

describe('Reenvío del mail de activación', () => {
  const reenviar = (autorizacion = recepcionA) =>
    request(app)
      .post(`/api/socios/${socioId}/reenviar-activacion`)
      .set('Authorization', autorizacion);

  it('manda un link nuevo y el anterior deja de servir', async () => {
    const tokenViejo = tokenDelUltimoCorreo();

    const respuesta = await reenviar();
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ correoEnviado: true });

    const tokenNuevo = tokenDelUltimoCorreo();
    expect(tokenNuevo).not.toBe(tokenViejo);
    expect((await activar(tokenViejo)).status).toBe(400);
    expect((await activar(tokenNuevo)).status).toBe(200);
  });

  it('no se reenvía si la cuenta ya está activada', async () => {
    await activar(tokenDelUltimoCorreo());
    const respuesta = await reenviar();
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.codigo).toBe('CUENTA_YA_ACTIVADA');
  });

  it('otro gimnasio no puede reenviar el mail de este socio', async () => {
    const respuesta = await reenviar(autorizacionDe(escenario.gimnasioB.recepcion));
    expect(respuesta.status).toBe(404);
  });
});
