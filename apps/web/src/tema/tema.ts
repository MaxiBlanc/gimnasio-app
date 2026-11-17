import { useEffect, useState } from 'react';

/**
 * Modo claro / oscuro. "sistema" sigue lo que tenga configurado el dispositivo.
 * La preferencia se guarda en localStorage: es una comodidad de este navegador, no un dato
 * importante, así que si localStorage falla (modo privado) simplemente no se recuerda.
 */
export type PreferenciaTema = 'sistema' | 'claro' | 'oscuro';
const CLAVE = 'gimnasioapp.tema';

function leerPreferencia(): PreferenciaTema {
  try {
    const guardada = localStorage.getItem(CLAVE);
    if (guardada === 'claro' || guardada === 'oscuro') return guardada;
  } catch {
    // sin localStorage: usamos el del sistema
  }
  return 'sistema';
}

/** Se llama antes de dibujar la app, para que no "parpadee" el tema equivocado. */
export function aplicarTemaGuardado() {
  aplicar(leerPreferencia());
}

function aplicar(preferencia: PreferenciaTema) {
  if (preferencia === 'sistema') delete document.documentElement.dataset.tema;
  else document.documentElement.dataset.tema = preferencia;
}

export function useTema() {
  const [preferencia, setPreferencia] = useState<PreferenciaTema>(leerPreferencia);

  useEffect(() => {
    aplicar(preferencia);
    try {
      if (preferencia === 'sistema') localStorage.removeItem(CLAVE);
      else localStorage.setItem(CLAVE, preferencia);
    } catch {
      // no se recuerda, no pasa nada
    }
  }, [preferencia]);

  return [preferencia, setPreferencia] as const;
}
