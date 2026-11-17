import {
  ESTADOS_CUOTA,
  NOMBRES_ESTADO_CUOTA,
  type EstadoCuota,
  type ResumenCuotas as Resumen,
} from '@gimnasio/compartido';
import estilos from './ResumenCuotas.module.css';

const DESCRIPCION: Record<EstadoCuota, string> = {
  AL_DIA: 'Pagaron este mes',
  POR_VENCER: 'Pagaron este mes, falta el próximo',
  PENDIENTE: 'Todavía no pagaron, están en término',
  VENCIDO: 'No pagaron y ya pasó el día de cierre',
};

/**
 * Cómo están las cuotas del gimnasio: una barra con la proporción de cada estado
 * (con los colores de los discos) y el detalle debajo.
 */
export function ResumenCuotas({ resumen }: { resumen: Resumen }) {
  const total = ESTADOS_CUOTA.reduce((suma, estado) => suma + resumen[estado], 0);

  return (
    <div className={estilos.resumen}>
      <div className={estilos.barra} role="img" aria-label={textoAccesible(resumen, total)}>
        {total === 0 ? (
          <span className={estilos.vacia} />
        ) : (
          ESTADOS_CUOTA.filter((estado) => resumen[estado] > 0).map((estado) => (
            <span
              key={estado}
              className={estilos.segmento}
              data-estado={estado}
              style={{ flexGrow: resumen[estado] }}
            />
          ))
        )}
      </div>

      <dl className={estilos.detalle}>
        {ESTADOS_CUOTA.map((estado) => (
          <div key={estado} className={estilos.estado} data-estado={estado}>
            <dt>{NOMBRES_ESTADO_CUOTA[estado]}</dt>
            <dd className={`titular numero ${estilos.cantidad}`}>{resumen[estado]}</dd>
            <dd className={estilos.descripcion}>{DESCRIPCION[estado]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function textoAccesible(resumen: Resumen, total: number) {
  if (total === 0) return 'Todavía no hay socios';
  return ESTADOS_CUOTA.map((estado) => `${NOMBRES_ESTADO_CUOTA[estado]}: ${resumen[estado]}`).join(
    ', ',
  );
}
