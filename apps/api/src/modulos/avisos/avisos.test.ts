import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { crearApp } from '../../app';
import { prisma } from '../../db';
import { crearEscenarioBase, crearSocioDePrueba, vaciarBase } from '../../test/datosDePrueba';
import { bandejaDePrueba } from '../correo/correo';
import { enviarAvisosDeCuota } from './avisos.servicio';

const app = crearApp();
let escenario: Awaited<ReturnType<typeof crearEscenarioBase>>;

const crearSocio = (dni: string, pagoHasta?: string) =>
  crearSocioDePrueba(escenario.gimnasioA.gimnasio, escenario.gimnasioA.dueno.id, {
    dni,
    pagoHasta,
  });

beforeEach(async () => {
  await vaciarBase();
  bandejaDePrueba.vaciar();
  escenario = await crearEscenarioBase();
  // 28 de noviembre: últimos días del mes (aviso "por vencer") y ya pasó el día 10 (vencidas).
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-28T15:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('avisos automáticos de cuota', () => {
  it('avisa "por vencer" y "vencida" a quien corresponde, una sola vez', async () => {
    await crearSocio('30000001', '2026-11-30'); // pagó noviembre, no diciembre
    await crearSocio('30000002', '2026-10-31'); // no pagó noviembre
    await crearSocio('30000003', '2026-12-31'); // ya pagó diciembre: nada

    expect(await enviarAvisosDeCuota()).toEqual({ enviados: 2, fallidos: 0 });
    const asuntos = bandejaDePrueba.correos.map((c) => `${c.para}: ${c.asunto}`).sort();
    expect(asuntos).toEqual([
      'socio30000001@ejemplo.com: Tu cuota de diciembre de 2026 está por vencer',
      'socio30000002@ejemplo.com: Tu cuota de noviembre de 2026 está vencida',
    ]);

    // Si el cron corre de nuevo, no repite.
    expect(await enviarAvisosDeCuota()).toEqual({ enviados: 0, fallidos: 0 });
  });

  it('si el mail falla, no lo anota y lo reintenta en la próxima corrida', async () => {
    await crearSocio('30000002', '2026-10-31');
    bandejaDePrueba.fallar = true;
    expect(await enviarAvisosDeCuota()).toEqual({ enviados: 0, fallidos: 1 });
    expect(await prisma.avisoEnviado.count()).toBe(0);

    bandejaDePrueba.fallar = false;
    expect(await enviarAvisosDeCuota()).toEqual({ enviados: 1, fallidos: 0 });
  });

  it('no avisa a socios dados de baja ni de gimnasios suspendidos', async () => {
    const socio = await crearSocio('30000002', '2026-10-31');
    await prisma.socio.update({ where: { id: socio.id }, data: { activo: false } });
    await crearSocioDePrueba(escenario.gimnasioB.gimnasio, escenario.gimnasioB.dueno.id, {
      dni: '40000002',
    });
    await prisma.gimnasio.update({
      where: { id: escenario.gimnasioB.gimnasio.id },
      data: { activo: false },
    });

    expect(await enviarAvisosDeCuota()).toEqual({ enviados: 0, fallidos: 0 });
  });
});

describe('GET /api/cron/avisos', () => {
  it('solo responde con el secreto del cron', async () => {
    const sinSecreto = await request(app).get('/api/cron/avisos');
    const conOtro = await request(app)
      .get('/api/cron/avisos')
      .set('Authorization', 'Bearer cualquier-cosa');
    const conSecreto = await request(app)
      .get('/api/cron/avisos')
      .set('Authorization', 'Bearer secreto-del-cron-para-tests');

    expect(sinSecreto.status).toBe(401);
    expect(conOtro.status).toBe(401);
    expect(conSecreto.status).toBe(200);
    expect(conSecreto.body).toEqual({ enviados: 0, fallidos: 0 });
  });
});
