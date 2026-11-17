import { describe, expect, it } from 'vitest';
import { calcularEstadoCuota, type ConfigCuotas } from './estadoCuota';

const config: ConfigCuotas = { diaCierreCobro: 10, diasAvisoVencimiento: 5 };
const f = (texto: string) => new Date(`${texto}T00:00:00Z`);

/** Atajo: estado con vencimiento y "hoy" escritos como texto. */
const estado = (vencimiento: string | null, hoy: string, conf = config) =>
  calcularEstadoCuota(vencimiento ? f(vencimiento) : null, f(hoy), conf);

describe('calcularEstadoCuota', () => {
  describe('con el mes actual pagado', () => {
    it('está AL_DIA durante el mes', () => {
      expect(estado('2026-11-30', '2026-11-01')).toBe('AL_DIA');
      expect(estado('2026-11-30', '2026-11-24')).toBe('AL_DIA'); // faltan 6 días
    });

    it('pasa a POR_VENCER en los últimos 5 días del mes', () => {
      expect(estado('2026-11-30', '2026-11-25')).toBe('POR_VENCER'); // faltan 5
      expect(estado('2026-11-30', '2026-11-30')).toBe('POR_VENCER'); // último día
    });

    it('si ya pagó el mes siguiente, sigue AL_DIA aunque termine el mes', () => {
      expect(estado('2026-12-31', '2026-11-28')).toBe('AL_DIA');
    });

    it('funciona con febrero y con cambio de año', () => {
      expect(estado('2027-02-28', '2027-02-23')).toBe('POR_VENCER'); // faltan 5
      expect(estado('2027-02-28', '2027-02-22')).toBe('AL_DIA'); // faltan 6
      expect(estado('2026-12-31', '2026-12-27')).toBe('POR_VENCER');
    });
  });

  describe('sin el mes actual pagado', () => {
    it('está PENDIENTE hasta el día de cierre (inclusive)', () => {
      expect(estado('2026-10-31', '2026-11-01')).toBe('PENDIENTE');
      expect(estado('2026-10-31', '2026-11-10')).toBe('PENDIENTE');
    });

    it('pasa a VENCIDO al día siguiente del cierre', () => {
      expect(estado('2026-10-31', '2026-11-11')).toBe('VENCIDO');
      expect(estado('2026-06-30', '2026-11-20')).toBe('VENCIDO'); // debe hace meses
    });

    it('un socio que nunca pagó sigue las mismas reglas', () => {
      expect(estado(null, '2026-11-05')).toBe('PENDIENTE');
      expect(estado(null, '2026-11-15')).toBe('VENCIDO');
    });
  });

  it('respeta la configuración de cada gimnasio', () => {
    const otroGimnasio = { diaCierreCobro: 5, diasAvisoVencimiento: 0 };
    expect(estado('2026-10-31', '2026-11-06', otroGimnasio)).toBe('VENCIDO');
    expect(estado('2026-11-30', '2026-11-29', otroGimnasio)).toBe('AL_DIA');
    expect(estado('2026-11-30', '2026-11-30', otroGimnasio)).toBe('POR_VENCER');
  });
});
