import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { crearApp } from '../../app';
import { prisma } from '../../db';
import {
  autorizacionDe,
  crearEscenarioBase,
  crearSocioDePrueba,
  vaciarBase,
} from '../../test/datosDePrueba';

const app = crearApp();
let escenario: Awaited<ReturnType<typeof crearEscenarioBase>>;

beforeEach(async () => {
  await vaciarBase();
  escenario = await crearEscenarioBase();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-15T15:00:00Z')); // 12:00 en Argentina
});

afterEach(() => {
  vi.useRealTimers();
});

describe('GET /api/tablero', () => {
  it('suma lo cobrado y agrupa las entradas en horario de Argentina', async () => {
    const { gimnasio, dueno } = escenario.gimnasioA;
    const socio = await crearSocioDePrueba(gimnasio, dueno.id, { pagoHasta: '2026-11-30' });
    await prisma.ingreso.createMany({
      data: [
        // 14/11 a las 23:30 en Argentina (15/11 02:30 UTC): cuenta para el 14, a las 23 h.
        { gimnasioId: gimnasio.id, socioId: socio.id, creadoEn: new Date('2026-11-15T02:30:00Z') },
        // Hoy a las 9:00 en Argentina.
        { gimnasioId: gimnasio.id, socioId: socio.id, creadoEn: new Date('2026-11-15T12:00:00Z') },
      ],
    });

    const respuesta = await request(app)
      .get('/api/tablero')
      .set('Authorization', autorizacionDe(dueno));

    expect(respuesta.status).toBe(200);
    const tablero = respuesta.body;
    expect(tablero.cobrado).toEqual({ mesActual: 20000, mesAnterior: 0 });
    expect(tablero.sociosActivos).toBe(1);
    expect(tablero.ingresos).toEqual({ hoy: 1, ultimos7Dias: 2 });
    expect(tablero.ingresosPorDia).toHaveLength(14);
    expect(tablero.ingresosPorDia.at(-1)).toEqual({ fecha: '2026-11-15', cantidad: 1 });
    expect(tablero.ingresosPorDia.at(-2)).toEqual({ fecha: '2026-11-14', cantidad: 1 });
    // El promedio por hora usa días completos (hoy no): solo la entrada de las 23 h.
    expect(tablero.ingresosPorHora[23].promedio).toBeGreaterThan(0);
    expect(tablero.ingresosPorHora[9].promedio).toBe(0);
  });

  it('es solo para el dueño', async () => {
    const respuesta = await request(app)
      .get('/api/tablero')
      .set('Authorization', autorizacionDe(escenario.gimnasioA.recepcion));
    expect(respuesta.status).toBe(403);
  });
});
