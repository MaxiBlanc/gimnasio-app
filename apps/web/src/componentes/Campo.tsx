import { useId, type InputHTMLAttributes, type Ref } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  etiqueta: string;
  error?: string | undefined;
  ayuda?: string;
  ref?: Ref<HTMLInputElement>;
}

/** Input con su etiqueta, texto de ayuda y error, conectados para lectores de pantalla. */
export function Campo({ etiqueta, error, ayuda, ref, ...resto }: Props) {
  const id = useId();
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;
  const descripcion = [ayuda && idAyuda, error && idError].filter(Boolean).join(' ') || undefined;
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      <input
        id={id}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={descripcion}
        {...resto}
      />
      {ayuda && (
        <small id={idAyuda} className="texto-suave">
          {ayuda}
        </small>
      )}
      {error && (
        <span id={idError} className="campo-error">
          {error}
        </span>
      )}
    </div>
  );
}
