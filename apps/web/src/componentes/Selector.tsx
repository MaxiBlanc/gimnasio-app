import { useId, type ReactNode, type Ref, type SelectHTMLAttributes } from 'react';

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  etiqueta: string;
  error?: string | undefined;
  ayuda?: string;
  ref?: Ref<HTMLSelectElement>;
  children: ReactNode;
}

/** Igual que <Campo>, pero para un <select>. */
export function Selector({ etiqueta, error, ayuda, ref, children, ...resto }: Props) {
  const id = useId();
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;
  const descripcion = [ayuda && idAyuda, error && idError].filter(Boolean).join(' ') || undefined;
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      <select
        id={id}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={descripcion}
        {...resto}
      >
        {children}
      </select>
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
