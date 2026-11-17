/**
 * Pasa un texto a minúsculas y sin acentos: "Pérez Núñez" → "perez nunez".
 *
 * Cómo funciona: normalize('NFD') separa cada letra de su acento ("é" pasa a ser "e" + "´"),
 * y \p{M} ("marca", con la bandera u de Unicode) borra los acentos que quedaron sueltos.
 */
export function normalizarTexto(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}
