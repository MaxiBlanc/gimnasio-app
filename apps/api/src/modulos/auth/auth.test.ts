import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { crearApp } from '../../app';
import { prisma } from '../../db';
import { CONTRASENA_PRUEBA, crearEscenarioBase, vaciarBase } from '../../test/datosDePrueba';

const app = crearApp();
let escenario: Awaited<ReturnType<typeof crearEscenarioBase>>;

beforeEach(async () => {
  await vaciarBase();
  escenario = await crearEscenarioBase();
});

/** Saca el valor de la cookie del token de refresco de una respuesta. */
function cookieRefresco(respuesta: request.Response): string {
  const cookies = ([] as string[]).concat(respuesta.headers['set-cookie'] ?? []);
  const cookie = cookies.find((c) => c.startsWith('token_refresco='));
  if (!cookie) throw new Error('La respuesta no trae la cookie de refresco');
  return cookie.split(';')[0]!; // "token_refresco=valor"
}

const loginStaff = (gimnasio: string, email: string, contrasena = CONTRASENA_PRUEBA) =>
  request(app).post('/api/auth/login').send({ gimnasio, email, contrasena });

describe('POST /api/auth/login (personal del gimnasio)', () => {
  it('con datos correctos devuelve token, usuario y la cookie de refresco', async () => {
    const respuesta = await loginStaff('gimnasio-a', 'dueno@gimnasio-a.com');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.tokenAcceso).toEqual(expect.any(String));
    expect(respuesta.body.usuario).toMatchObject({
      email: 'dueno@gimnasio-a.com',
      rol: 'DUENO',
      gimnasio: { slug: 'gimnasio-a' },
    });
    // Nunca se devuelve el hash de la contraseña.
    expect(JSON.stringify(respuesta.body)).not.toContain('hash');

    const cookie = ([] as string[]).concat(respuesta.headers['set-cookie'] ?? []).join(';');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
  });

  it('ignora mayúsculas y espacios en el email', async () => {
    const respuesta = await loginStaff('gimnasio-a', '  DUENO@Gimnasio-A.com ');
    expect(respuesta.status).toBe(200);
  });

  it('con contraseña incorrecta o email inexistente responde el MISMO error', async () => {
    const malaContrasena = await loginStaff('gimnasio-a', 'dueno@gimnasio-a.com', 'otra');
    const emailInexistente = await loginStaff('gimnasio-a', 'nadie@gimnasio-a.com');

    expect(malaContrasena.status).toBe(401);
    expect(emailInexistente.status).toBe(401);
    expect(malaContrasena.body).toEqual(emailInexistente.body);
  });

  it('un usuario NO puede entrar por otro gimnasio', async () => {
    const respuesta = await loginStaff('gimnasio-b', 'dueno@gimnasio-a.com');
    expect(respuesta.status).toBe(401);
  });

  it('rechaza usuarios desactivados y gimnasios suspendidos', async () => {
    await prisma.usuario.update({
      where: { id: escenario.gimnasioA.recepcion.id },
      data: { activo: false },
    });
    await prisma.gimnasio.update({
      where: { id: escenario.gimnasioB.gimnasio.id },
      data: { activo: false },
    });

    expect((await loginStaff('gimnasio-a', 'recepcion@gimnasio-a.com')).status).toBe(401);
    expect((await loginStaff('gimnasio-b', 'dueno@gimnasio-b.com')).status).toBe(401);
  });

  it('el súper-admin no puede usar el login de un gimnasio', async () => {
    const respuesta = await loginStaff('gimnasio-a', 'admin@test.com');
    expect(respuesta.status).toBe(401);
  });

  it('con datos mal formados responde 400 indicando el campo', async () => {
    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({ gimnasio: 'gimnasio-a', email: 'no-es-un-email', contrasena: 'x' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.campos).toContainEqual(expect.objectContaining({ campo: 'email' }));
  });
});

describe('POST /api/auth/admin/login', () => {
  it('el súper-admin entra y no tiene gimnasio', async () => {
    const respuesta = await request(app)
      .post('/api/auth/admin/login')
      .send({ email: 'admin@test.com', contrasena: CONTRASENA_PRUEBA });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.usuario).toMatchObject({ rol: 'SUPERADMIN', gimnasio: null });
  });

  it('el personal de un gimnasio no puede entrar como súper-admin', async () => {
    const respuesta = await request(app)
      .post('/api/auth/admin/login')
      .send({ email: 'dueno@gimnasio-a.com', contrasena: CONTRASENA_PRUEBA });

    expect(respuesta.status).toBe(401);
  });
});

describe('GET /api/auth/yo', () => {
  it('sin token responde 401', async () => {
    const respuesta = await request(app).get('/api/auth/yo');
    expect(respuesta.status).toBe(401);
  });

  it('con un token inválido o manipulado responde 401', async () => {
    const login = await loginStaff('gimnasio-a', 'recepcion@gimnasio-a.com');
    const tokenManipulado = login.body.tokenAcceso.slice(0, -2) + 'xx';

    const respuesta = await request(app)
      .get('/api/auth/yo')
      .set('Authorization', `Bearer ${tokenManipulado}`);
    expect(respuesta.status).toBe(401);
  });

  it('con token válido devuelve el usuario logueado', async () => {
    const login = await loginStaff('gimnasio-a', 'profe@gimnasio-a.com');

    const respuesta = await request(app)
      .get('/api/auth/yo')
      .set('Authorization', `Bearer ${login.body.tokenAcceso}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({ email: 'profe@gimnasio-a.com', rol: 'PROFESOR' });
  });
});

describe('Refresco y cierre de sesión', () => {
  it('canjea la cookie por un token nuevo y ROTA la cookie (la vieja deja de servir)', async () => {
    const login = await loginStaff('gimnasio-a', 'dueno@gimnasio-a.com');
    const cookieVieja = cookieRefresco(login);

    const refresco = await request(app).post('/api/auth/refrescar').set('Cookie', cookieVieja);
    expect(refresco.status).toBe(200);
    expect(refresco.body.tokenAcceso).toEqual(expect.any(String));
    const cookieNueva = cookieRefresco(refresco);
    expect(cookieNueva).not.toBe(cookieVieja);

    // Reusar la cookie vieja falla...
    const reuso = await request(app).post('/api/auth/refrescar').set('Cookie', cookieVieja);
    expect(reuso.status).toBe(401);
    // ...y la nueva funciona.
    const otraVez = await request(app).post('/api/auth/refrescar').set('Cookie', cookieNueva);
    expect(otraVez.status).toBe(200);
  });

  it('sin cookie responde 401', async () => {
    const respuesta = await request(app).post('/api/auth/refrescar');
    expect(respuesta.status).toBe(401);
  });

  it('si desactivan al usuario, ya no puede refrescar la sesión', async () => {
    const login = await loginStaff('gimnasio-a', 'recepcion@gimnasio-a.com');
    await prisma.usuario.update({
      where: { id: escenario.gimnasioA.recepcion.id },
      data: { activo: false },
    });

    const respuesta = await request(app)
      .post('/api/auth/refrescar')
      .set('Cookie', cookieRefresco(login));
    expect(respuesta.status).toBe(401);
  });

  it('salir revoca la sesión: la cookie deja de servir', async () => {
    const login = await loginStaff('gimnasio-a', 'dueno@gimnasio-a.com');
    const cookie = cookieRefresco(login);

    const salida = await request(app).post('/api/auth/salir').set('Cookie', cookie);
    expect(salida.status).toBe(204);

    const respuesta = await request(app).post('/api/auth/refrescar').set('Cookie', cookie);
    expect(respuesta.status).toBe(401);
  });

  it('la base guarda el hash del token, nunca el token', async () => {
    const login = await loginStaff('gimnasio-a', 'dueno@gimnasio-a.com');
    const token = cookieRefresco(login).split('=')[1]!;

    const sesiones = await prisma.sesion.findMany();
    expect(sesiones).toHaveLength(1);
    expect(sesiones[0]!.hashToken).not.toBe(token);
  });
});
