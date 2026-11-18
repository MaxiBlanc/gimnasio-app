import { useQuery } from '@tanstack/react-query';
import type { NivelOcupacion, Ocupacion as DatosOcupacion } from '@gimnasio/compartido';
import { pedir } from '../api/cliente';
import estilos from './Ocupacion.module.css';

const TEXTO_NIVEL: Record<NivelOcupacion, string> = {
  BAJA: 'Tranqui',
  MEDIA: 'Movido',
  ALTA: 'Lleno',
};

/**
 * Cuánta gente hay ahora en el gimnasio (estimado). Se actualiza sola cada minuto
 * (`refetchInterval`), así queda bien en una pantalla que se deja abierta.
 */
export function Ocupacion() {
  const consulta = useQuery({
    queryKey: ['ocupacion'],
    queryFn: () => pedir<DatosOcupacion>('/ocupacion'),
    refetchInterval: 60_000,
  });

  if (consulta.isPending) return <div className={estilos.tarjeta}>Cargando ocupación…</div>;
  if (consulta.isError) return null; // No es vital: si falla, no mostramos nada.

  const { personas, capacidadMaxima, nivel, minutosPermanencia } = consulta.data;
  const porcentaje = capacidadMaxima ? Math.min(100, (personas / capacidadMaxima) * 100) : null;

  return (
    <section className={estilos.tarjeta} aria-labelledby="titulo-ocupacion">
      <h2 id="titulo-ocupacion" className={estilos.titulo}>
        Ahora en el gimnasio
      </h2>
      <p className={estilos.cifra}>
        <span className="numero">{personas}</span>{' '}
        <span className={estilos.unidad}>{personas === 1 ? 'persona' : 'personas'}</span>
        {nivel && (
          <span className={estilos.nivel} data-nivel={nivel}>
            {TEXTO_NIVEL[nivel]}
          </span>
        )}
      </p>
      {porcentaje !== null && (
        <div
          className={estilos.barra}
          role="meter"
          aria-label="Ocupación"
          aria-valuemin={0}
          aria-valuemax={capacidadMaxima ?? 0}
          aria-valuenow={personas}
        >
          <div className={estilos.relleno} data-nivel={nivel} style={{ width: `${porcentaje}%` }} />
        </div>
      )}
      <p className={estilos.nota}>
        Estimado con quienes entraron en los últimos {minutosPermanencia} minutos.
      </p>
    </section>
  );
}
