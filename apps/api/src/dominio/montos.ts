/**
 * Cálculo del monto de un pago. Función pura: sin base de datos, fácil de testear.
 *
 * Todo se calcula en CENTAVOS (números enteros) y recién al final se pasa a pesos.
 * Con decimales en coma flotante, 0.1 + 0.2 da 0.30000000000000004; con enteros, no hay error.
 */

export type DescuentoAplicable = { tipo: 'PORCENTAJE' | 'MONTO_FIJO'; valor: number };

export interface MontosPago {
  montoBase: number;
  montoDescuento: number;
  montoFinal: number;
}

const aCentavos = (pesos: number) => Math.round(pesos * 100);
const aPesos = (centavos: number) => centavos / 100;

export function calcularMontos(precio: number, descuento: DescuentoAplicable | null): MontosPago {
  const base = aCentavos(precio);

  let rebaja = 0;
  if (descuento?.tipo === 'PORCENTAJE') {
    // Redondeo al centavo más cercano: 10 % de $333,33 = $33,33.
    rebaja = Math.round((base * descuento.valor) / 100);
  } else if (descuento?.tipo === 'MONTO_FIJO') {
    rebaja = aCentavos(descuento.valor);
  }
  // Un descuento nunca puede dejar el monto en negativo.
  rebaja = Math.min(rebaja, base);

  return {
    montoBase: aPesos(base),
    montoDescuento: aPesos(rebaja),
    montoFinal: aPesos(base - rebaja),
  };
}
