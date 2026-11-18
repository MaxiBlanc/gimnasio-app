import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import type { ClaseEnFecha } from '@gimnasio/compartido';
import { pedir } from '../../api/cliente';
import { Lugares } from '../clases/Clases';
import propios from '../clases/clases.module.css';
import { agruparPorFecha, tituloDeFecha } from '../clases/fechas';

const CLAVE = ['mi-cuenta', 'clases'];

/** Agenda de la semana: el socio se anota o se da de baja con un toque. */
export function MisClases() {
  const agenda = useQuery({
    queryKey: CLAVE,
    queryFn: () => pedir<ClaseEnFecha[]>('/mi-cuenta/clases'),
  });

  return (
    <>
      <h1 className="titulo-pagina">Clases</h1>
      <p className="texto-suave">
        Anotate para reservar tu lugar. Podés bajarte hasta que empiece.
      </p>
      {agenda.isPending && <p className="texto-suave">Cargando…</p>}
      {agenda.isError && (
        <p className="alerta-error" role="alert">
          {agenda.error.message}
        </p>
      )}
      {agenda.data?.length === 0 && (
        <p className="texto-suave">No hay clases en los próximos días.</p>
      )}
      {agenda.data &&
        agruparPorFecha(agenda.data).map(([fecha, delDia]) => (
          <section key={fecha} className={propios.dia} aria-label={tituloDeFecha(fecha)}>
            <h2 className={propios.tituloDia}>{tituloDeFecha(fecha)}</h2>
            <ul className={propios.lista}>
              {delDia.map((clase) => (
                <ClaseDelSocio key={clase.claseId} clase={clase} />
              ))}
            </ul>
          </section>
        ))}
    </>
  );
}

function ClaseDelSocio({ clase }: { clase: ClaseEnFecha }) {
  const clienteQuery = useQueryClient();
  const ruta = `/mi-cuenta/clases/${clase.claseId}/inscripcion`;
  const cambiar = useMutation({
    mutationFn: () =>
      clase.anotado
        ? pedir<void>(`${ruta}?fecha=${clase.fecha}`, { metodo: 'DELETE' })
        : pedir<void>(ruta, { metodo: 'POST', cuerpo: { fecha: clase.fecha } }),
    // Tanto si salió bien como si no (ej. se llenó recién), traemos los lugares al día.
    onSettled: () => clienteQuery.invalidateQueries({ queryKey: CLAVE }),
  });
  const llena = clase.inscriptos >= clase.cupo;

  return (
    <li className={propios.clase}>
      <span className={`numero ${propios.hora}`}>{clase.horaInicio}</span>
      <div className={propios.detalle}>
        <strong>{clase.nombre}</strong>
        <span className={propios.meta}>
          {clase.duracionMinutos} min{clase.profesor && ` · ${clase.profesor}`}
        </span>
        {clase.anotado && (
          <span className={propios.anotado}>
            <Check size={14} aria-hidden /> Estás anotado
          </span>
        )}
      </div>
      <Lugares inscriptos={clase.inscriptos} cupo={clase.cupo} />
      <div className={propios.accion}>
        <button
          type="button"
          className={`boton ${clase.anotado ? 'boton-secundario' : 'boton-principal'}`}
          disabled={cambiar.isPending || (llena && !clase.anotado)}
          onClick={() => cambiar.mutate()}
        >
          {cambiar.isPending
            ? 'Un momento…'
            : clase.anotado
              ? 'Darme de baja'
              : llena
                ? 'Sin lugar'
                : 'Anotarme'}
        </button>
        {cambiar.isError && (
          <p className="alerta-error" role="alert">
            {cambiar.error.message}
          </p>
        )}
      </div>
    </li>
  );
}
