import { describe, expect, it } from 'vitest';
import { finDeMes, hoyEnArgentina, inicioDeMes, periodoDePago, sumarMeses } from './periodos';

/** Helper para comparar fechas DATE como texto AAAA-MM-DD. */
const dia = (fecha: Date) => fecha.toISOString().slice(0, 10);

describe('periodos', () => {
  it('calcula inicio y fin de mes, incluyendo febrero bisiesto', () => {
    expect(dia(inicioDeMes({ anio: 2026, mes: 11 }))).toBe('2026-11-01');
    expect(dia(finDeMes({ anio: 2026, mes: 11 }))).toBe('2026-11-30');
    expect(dia(finDeMes({ anio: 2028, mes: 2 }))).toBe('2028-02-29');
    expect(dia(finDeMes({ anio: 2027, mes: 2 }))).toBe('2027-02-28');
  });

  it('suma y resta meses cruzando de año', () => {
    expect(sumarMeses({ anio: 2026, mes: 11 }, 3)).toEqual({ anio: 2027, mes: 2 });
    expect(sumarMeses({ anio: 2026, mes: 1 }, -1)).toEqual({ anio: 2025, mes: 12 });
    expect(sumarMeses({ anio: 2026, mes: 12 }, 0)).toEqual({ anio: 2026, mes: 12 });
  });

  it('un plan trimestral desde noviembre cubre del 1/11 al 31/1', () => {
    const { periodoDesde, periodoHasta } = periodoDePago({ anio: 2026, mes: 11 }, 3);
    expect(dia(periodoDesde)).toBe('2026-11-01');
    expect(dia(periodoHasta)).toBe('2027-01-31');
  });

  it('rechaza duraciones inválidas', () => {
    expect(() => periodoDePago({ anio: 2026, mes: 11 }, 0)).toThrow();
  });

  it('"hoy" usa la hora de Argentina, no la del servidor', () => {
    // 1/12 a las 01:00 UTC todavía es 30/11 a las 22:00 en Argentina (UTC-3).
    expect(dia(hoyEnArgentina(new Date('2026-12-01T01:00:00Z')))).toBe('2026-11-30');
  });
});
