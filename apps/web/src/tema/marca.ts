/**
 * Marca del gimnasio: cada gimnasio elige su color principal y el secundario.
 * Los pasamos a variables CSS en <html>, así todos los componentes los usan sin enterarse.
 */

export interface ColoresMarca {
  colorPrimario: string;
  colorSecundario: string;
}

/** Colores propios de GimnasioApp (pantallas sin gimnasio: inicio y súper-admin). */
export const MARCA_APP: ColoresMarca = { colorPrimario: '#2F6BFF', colorSecundario: '#1A1E23' };

/** Luminancia relativa (fórmula de WCAG): 0 es negro, 1 es blanco. */
function luminancia(hex: string): number {
  const canales = [1, 3, 5].map((inicio) => {
    const valor = parseInt(hex.slice(inicio, inicio + 2), 16) / 255;
    return valor <= 0.03928 ? valor / 12.92 : ((valor + 0.055) / 1.055) ** 2.4;
  });
  const [r = 0, g = 0, b = 0] = canales;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Color de texto legible sobre un fondo dado: negro o blanco, el que más contraste.
 * Sin esto, un gimnasio con color amarillo tendría botones con texto blanco ilegible.
 */
export function textoSobre(fondo: string): string {
  const l = luminancia(fondo);
  const contrasteConNegro = (l + 0.05) / 0.05;
  const contrasteConBlanco = 1.05 / (l + 0.05);
  return contrasteConNegro >= contrasteConBlanco ? '#1A1E23' : '#FFFFFF';
}

/** Relación de contraste entre dos colores (1 = iguales, 21 = negro sobre blanco). */
export function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x) as [number, number];
  return (claro + 0.05) / (oscuro + 0.05);
}

export function aplicarMarca(colores: ColoresMarca) {
  const raiz = document.documentElement.style;
  raiz.setProperty('--marca', colores.colorPrimario);
  raiz.setProperty('--sobre-marca', textoSobre(colores.colorPrimario));
  raiz.setProperty('--marca-oscura', colores.colorSecundario);
  raiz.setProperty('--sobre-marca-oscura', textoSobre(colores.colorSecundario));
}
