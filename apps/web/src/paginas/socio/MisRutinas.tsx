import { useQuery } from '@tanstack/react-query';
import type { Rutina } from '@gimnasio/compartido';
import { pedir } from '../../api/cliente';
import { formatearFecha } from '../../formato';
import { RutinaLectura } from '../rutinas/RutinaLectura';
import estilos from './MiCuenta.module.css';

/** Las rutinas que le armó el profe, para seguirlas desde el celular en el gimnasio. */
export function MisRutinas() {
  const rutinas = useQuery({
    queryKey: ['mi-cuenta', 'rutinas'],
    queryFn: () => pedir<Rutina[]>('/mi-cuenta/rutinas'),
  });

  return (
    <>
      <h1 className="titulo-pagina">Tus rutinas</h1>
      {rutinas.isPending && <p className="texto-suave">Cargando…</p>}
      {rutinas.isError && (
        <p className="alerta-error" role="alert">
          {rutinas.error.message}
        </p>
      )}
      {rutinas.data?.length === 0 && (
        <p className="texto-suave">
          Todavía no tenés rutinas. Pedile una al profe y te va a aparecer acá.
        </p>
      )}
      {rutinas.data?.map((rutina, i) => (
        // La más reciente queda abierta; las otras, plegadas para no hacer scroll de más.
        <details key={rutina.id} className={estilos.rutina} open={i === 0}>
          <summary>
            <span className={estilos.nombreRutina}>{rutina.nombre}</span>
            <span className={estilos.fecha}>
              Actualizada el {formatearFecha(rutina.actualizadoEn)} · {rutina.creadaPor.nombre}
            </span>
          </summary>
          {rutina.descripcion && <p className={estilos.descripcion}>{rutina.descripcion}</p>}
          <RutinaLectura dias={rutina.dias} />
        </details>
      ))}
    </>
  );
}
