import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { DatosGuardarRutina } from '@gimnasio/compartido';
import { crearApp } from '../../app';
import {
  autorizacionDe,
  crearEscenarioBase,
  crearSocioDePrueba,
  vaciarBase,
} from '../../test/datosDePrueba';

const app = crearApp();
let escenario: Awaited<ReturnType<typeof crearEscenarioBase>>;

const RUTINA: DatosGuardarRutina = {
  nombre: 'Fuerza principiante',
  descripcion: 'Tres días, cuerpo completo',
  dias: [
    {
      nombre: 'Día 1',
      ejercicios: [
        { nombre: 'Sentadilla', series: 4, repeticiones: '8-10', descanso: '90 seg', notas: '' },
        { nombre: 'Press de banca', series: 3, repeticiones: '10', descanso: '', notas: '' },
      ],
    },
  ],
};

const como = (usuario: Parameters<typeof autorizacionDe>[0]) => ({
  get: (ruta: string) => request(app).get(ruta).set('Authorization', autorizacionDe(usuario)),
  post: (ruta: string, cuerpo: object) =>
    request(app).post(ruta).set('Authorization', autorizacionDe(usuario)).send(cuerpo),
  put: (ruta: string, cuerpo: object) =>
    request(app).put(ruta).set('Authorization', autorizacionDe(usuario)).send(cuerpo),
});

beforeEach(async () => {
  await vaciarBase();
  escenario = await crearEscenarioBase();
});

describe('plantillas de rutinas', () => {
  it('el profe crea una plantilla y aparece en la lista con su resumen', async () => {
    const profe = como(escenario.gimnasioA.profesor);
    const creada = await profe.post('/api/rutinas/plantillas', RUTINA);
    expect(creada.status).toBe(201);
    expect(creada.body).toMatchObject({ nombre: 'Fuerza principiante', socioId: null });

    const lista = await profe.get('/api/rutinas/plantillas');
    expect(lista.body).toEqual([
      expect.objectContaining({ cantidadDias: 1, cantidadEjercicios: 2 }),
    ]);
  });

  it('valida la rutina: un día sin ejercicios no se puede guardar', async () => {
    const respuesta = await como(escenario.gimnasioA.profesor).post('/api/rutinas/plantillas', {
      ...RUTINA,
      dias: [{ nombre: 'Día 1', ejercicios: [] }],
    });
    expect(respuesta.status).toBe(400);
  });

  it('recepción no arma rutinas, y nadie ve las de otro gimnasio', async () => {
    const creada = await como(escenario.gimnasioA.profesor).post('/api/rutinas/plantillas', RUTINA);
    expect((await como(escenario.gimnasioA.recepcion).get('/api/rutinas/plantillas')).status).toBe(
      403,
    );
    expect(
      (await como(escenario.gimnasioB.profesor).get(`/api/rutinas/${creada.body.id}`)).status,
    ).toBe(404);
  });
});

describe('rutinas de un socio', () => {
  it('asignar una plantilla crea una COPIA: editar la copia no cambia la plantilla', async () => {
    const { gimnasio, dueno, profesor } = escenario.gimnasioA;
    const socio = await crearSocioDePrueba(gimnasio, dueno.id);
    const profe = como(profesor);
    const plantilla = await profe.post('/api/rutinas/plantillas', RUTINA);

    const copia = await profe.post(`/api/socios/${socio.id}/rutinas`, {
      plantillaId: plantilla.body.id,
    });
    expect(copia.status).toBe(201);
    expect(copia.body.id).not.toBe(plantilla.body.id);
    expect(copia.body).toMatchObject({ socioId: socio.id, nombre: RUTINA.nombre });

    await profe.put(`/api/rutinas/${copia.body.id}`, { ...RUTINA, nombre: 'Ajustada para Juan' });
    const original = await profe.get(`/api/rutinas/${plantilla.body.id}`);
    expect(original.body.nombre).toBe('Fuerza principiante');
  });

  it('el socio ve sus rutinas (y solo las suyas)', async () => {
    const { gimnasio, dueno, profesor } = escenario.gimnasioA;
    const juan = await crearSocioDePrueba(gimnasio, dueno.id, { dni: '30000001' });
    const ana = await crearSocioDePrueba(gimnasio, dueno.id, { dni: '30000002' });
    await como(profesor).post(`/api/socios/${juan.id}/rutinas`, RUTINA);

    const socio = (id: string) => ({ id, roles: ['SOCIO' as const], gimnasioId: gimnasio.id });
    const deJuan = await como(socio(juan.id)).get('/api/mi-cuenta/rutinas');
    const deAna = await como(socio(ana.id)).get('/api/mi-cuenta/rutinas');

    expect(deJuan.body).toHaveLength(1);
    expect(deJuan.body[0].dias[0].ejercicios[0].nombre).toBe('Sentadilla');
    expect(deAna.body).toEqual([]);
  });

  it('un socio no puede usar las rutas de rutinas del panel', async () => {
    const { gimnasio, dueno } = escenario.gimnasioA;
    const socio = await crearSocioDePrueba(gimnasio, dueno.id);
    const respuesta = await como({ id: socio.id, roles: ['SOCIO'], gimnasioId: gimnasio.id }).get(
      '/api/rutinas/plantillas',
    );
    expect(respuesta.status).toBe(403);
  });
});
