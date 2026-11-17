import { Monitor, Moon, Sun } from 'lucide-react';
import { useTema, type PreferenciaTema } from '../tema/tema';

const SIGUIENTE: Record<PreferenciaTema, PreferenciaTema> = {
  sistema: 'claro',
  claro: 'oscuro',
  oscuro: 'sistema',
};
const ETIQUETA: Record<PreferenciaTema, string> = {
  sistema: 'Tema: el del dispositivo',
  claro: 'Tema: claro',
  oscuro: 'Tema: oscuro',
};

/** Alterna entre claro, oscuro y el del dispositivo. */
export function BotonTema({ conTexto = false }: { conTexto?: boolean }) {
  const [preferencia, setPreferencia] = useTema();
  const Icono = preferencia === 'claro' ? Sun : preferencia === 'oscuro' ? Moon : Monitor;
  return (
    <button
      type="button"
      className={`boton boton-fantasma ${conTexto ? '' : 'boton-icono'}`}
      onClick={() => setPreferencia(SIGUIENTE[preferencia])}
      title={ETIQUETA[preferencia]}
      aria-label={ETIQUETA[preferencia]}
    >
      <Icono size={18} aria-hidden="true" />
      {conTexto && <span>{ETIQUETA[preferencia].replace('Tema: ', 'Tema ')}</span>}
    </button>
  );
}
