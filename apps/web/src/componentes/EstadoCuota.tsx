import { NOMBRES_ESTADO_CUOTA, type EstadoCuota as Estado } from '@gimnasio/compartido';

/** Etiqueta con el color del estado de la cuota (los colores de los discos). */
export function EstadoCuota({ estado }: { estado: Estado }) {
  return (
    <span className="etiqueta-estado" data-estado={estado}>
      {NOMBRES_ESTADO_CUOTA[estado]}
    </span>
  );
}
