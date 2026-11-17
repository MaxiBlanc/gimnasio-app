import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { contraste, type ColoresMarca } from '../tema/marca';
import { BotonTema } from './BotonTema';
import estilos from './PantallaIngreso.module.css';

interface Props {
  /** Nombre que se pinta en grande, como rotulado en la pared del gimnasio. */
  nombre: string;
  logoUrl?: string | null;
  colores: ColoresMarca;
  pie?: ReactNode;
  children: ReactNode;
}

/**
 * Tamaño máximo del nombre, en px: con nombres cortos ("Fit") no queremos letras gigantes.
 * En el celular la pared es una franja arriba, así que el tope es más chico.
 */
const tamanoMaximo = () => (window.matchMedia('(max-width: 52rem)').matches ? 80 : 176);

/**
 * Ajusta el tamaño de letra para que la palabra más larga ocupe todo el ancho disponible.
 * Se mide de verdad (cada letra tiene un ancho distinto: la W es más ancha que la I),
 * y se vuelve a medir si cambia el tamaño de la pantalla o terminan de cargar las fuentes.
 */
function useTextoAlAncho(texto: string) {
  const referencia = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const elemento = referencia.current;
    if (!elemento) return;
    const ajustar = () => {
      const BASE = 100;
      elemento.style.fontSize = `${BASE}px`;
      const disponible = elemento.clientWidth;
      const masAncha = Math.max(
        ...Array.from(elemento.children, (hijo) => (hijo as HTMLElement).scrollWidth),
      );
      if (masAncha > 0) {
        elemento.style.fontSize = `${Math.min((BASE * disponible) / masAncha, tamanoMaximo())}px`;
      }
    };
    ajustar();
    const observador = new ResizeObserver(ajustar);
    observador.observe(elemento.parentElement ?? elemento);
    void document.fonts.ready.then(ajustar);
    return () => observador.disconnect();
  }, [texto]);

  return referencia;
}

/**
 * Pantalla partida para login y para elegir gimnasio: a la izquierda la "pared" con el
 * nombre del gimnasio en sus colores; a la derecha el formulario.
 * En el celular la pared queda arriba, como una franja.
 */
export function PantallaIngreso({ nombre, logoUrl, colores, pie, children }: Props) {
  const palabras = nombre.trim().split(/\s+/);
  const referenciaNombre = useTextoAlAncho(nombre);
  // Si el color principal casi no se ve sobre el secundario, el nombre va en blanco o negro.
  const nombreLegible = contraste(colores.colorPrimario, colores.colorSecundario) >= 3;
  const variables = {
    '--color-nombre': nombreLegible ? colores.colorPrimario : 'var(--sobre-marca-oscura)',
  } as CSSProperties;

  return (
    <div className={estilos.pantalla}>
      <section className={estilos.pared} style={variables} aria-label={nombre}>
        {logoUrl && <img className={estilos.logo} src={logoUrl} alt="" />}
        <p ref={referenciaNombre} className={`titular ${estilos.nombre}`} aria-hidden="true">
          {palabras.map((palabra, indice) => (
            <span key={indice}>{palabra}</span>
          ))}
        </p>
        <p className={estilos.firma}>Gestionado con GimnasioApp</p>
      </section>

      <main className={estilos.lado}>
        <div className={estilos.barra}>
          <BotonTema />
        </div>
        <div className={estilos.formulario}>{children}</div>
        {pie && <div className={estilos.pie}>{pie}</div>}
      </main>
    </div>
  );
}
