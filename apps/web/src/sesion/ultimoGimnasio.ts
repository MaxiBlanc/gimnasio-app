/**
 * Recordamos el último gimnasio donde se inició sesión en ESTE navegador, para ofrecer
 * "Seguir en Power Gym" sin tener que escribir el código. Es solo una comodidad:
 * si localStorage no está disponible, no se recuerda y listo.
 */
const CLAVE = 'gimnasioapp.ultimoGimnasio';

export interface UltimoGimnasio {
  slug: string;
  nombre: string;
}

export function leerUltimoGimnasio(): UltimoGimnasio | null {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as UltimoGimnasio | null;
    return guardado?.slug && guardado.nombre ? guardado : null;
  } catch {
    return null;
  }
}

export function guardarUltimoGimnasio(gimnasio: UltimoGimnasio) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ slug: gimnasio.slug, nombre: gimnasio.nombre }));
  } catch {
    // no se recuerda
  }
}
