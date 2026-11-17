import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import estilos from './Dialogo.module.css';

interface Props {
  abierto: boolean;
  alCerrar: () => void;
  titulo: string;
  children: ReactNode;
}

/**
 * Ventana modal con el <dialog> nativo del navegador. `showModal()` ya resuelve lo difícil:
 * bloquea el fondo, mantiene el foco adentro y se cierra con Escape.
 */
export function Dialogo({ abierto, alCerrar, titulo, children }: Props) {
  const referencia = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialogo = referencia.current;
    if (!dialogo) return;
    if (abierto && !dialogo.open) dialogo.showModal();
    if (!abierto && dialogo.open) dialogo.close();
  }, [abierto]);

  return (
    <dialog
      ref={referencia}
      className={estilos.dialogo}
      onClose={alCerrar}
      aria-labelledby="titulo-dialogo"
      // Click en el fondo oscuro (fuera del contenido) = cerrar.
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) alCerrar();
      }}
    >
      {abierto && (
        <div className={estilos.contenido}>
          <header className={estilos.encabezado}>
            <h2 id="titulo-dialogo" className={estilos.titulo}>
              {titulo}
            </h2>
            <button
              type="button"
              className="boton boton-fantasma boton-icono"
              onClick={alCerrar}
              aria-label="Cerrar"
            >
              <X size={20} aria-hidden />
            </button>
          </header>
          {children}
        </div>
      )}
    </dialog>
  );
}
