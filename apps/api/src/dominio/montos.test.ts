import { describe, expect, it } from 'vitest';
import { calcularMontos } from './montos';

describe('calcularMontos', () => {
  it('sin descuento, el final es el precio', () => {
    expect(calcularMontos(30000, null)).toEqual({
      montoBase: 30000,
      montoDescuento: 0,
      montoFinal: 30000,
    });
  });

  it('aplica un porcentaje', () => {
    expect(calcularMontos(30000, { tipo: 'PORCENTAJE', valor: 10 })).toEqual({
      montoBase: 30000,
      montoDescuento: 3000,
      montoFinal: 27000,
    });
  });

  it('redondea el porcentaje al centavo', () => {
    // 15 % de 333,33 = 49,9995 → 50,00
    expect(calcularMontos(333.33, { tipo: 'PORCENTAJE', valor: 15 })).toEqual({
      montoBase: 333.33,
      montoDescuento: 50,
      montoFinal: 283.33,
    });
  });

  it('no arrastra errores de coma flotante', () => {
    // En flotante, 0.1 + 0.2 = 0.30000000000000004. Con centavos da exacto.
    const { montoFinal } = calcularMontos(0.3, { tipo: 'MONTO_FIJO', valor: 0.1 });
    expect(montoFinal).toBe(0.2);
  });

  it('aplica un monto fijo', () => {
    expect(calcularMontos(30000, { tipo: 'MONTO_FIJO', valor: 5000 }).montoFinal).toBe(25000);
  });

  it('un descuento mayor al precio deja el monto en 0, nunca negativo', () => {
    expect(calcularMontos(3000, { tipo: 'MONTO_FIJO', valor: 5000 })).toEqual({
      montoBase: 3000,
      montoDescuento: 3000,
      montoFinal: 0,
    });
  });

  it('100 % de descuento es gratis', () => {
    expect(calcularMontos(30000, { tipo: 'PORCENTAJE', valor: 100 }).montoFinal).toBe(0);
  });
});
