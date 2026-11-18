import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import {
  esquemaCrearClase,
  NOMBRES_DIA_SEMANA,
  type Clase,
  type ClaseEnFecha,
  type DatosCrearClase,
} from '@gimnasio/compartido';
import { pedir } from '../../api/cliente';
import { mostrarErrorEnFormulario } from '../../api/formularios';
import { Campo } from '../../componentes/Campo';
import { Dialogo } from '../../componentes/Dialogo';
import { Selector } from '../../componentes/Selector';
import { useSesion } from '../../sesion/sesion';
import estilos from '../paginas.module.css';
import tabla from '../tabla.module.css';
import propios from './clases.module.css';
import { agruparPorFecha, tituloDeFecha } from './fechas';

/** Clases del gimnasio: la agenda de la semana (con anotados) y el cronograma fijo. */
export function Clases() {
  const { usuario } = useSesion();
  const esDueno = usuario?.rol === 'DUENO';
  // undefined = cerrado; null = nueva; un objeto = editar esa.
  const [editando, setEditando] = useState<Clase | null>();

  const agenda = useQuery({
    queryKey: ['clases', 'agenda'],
    queryFn: () => pedir<ClaseEnFecha[]>('/clases/agenda'),
    refetchInterval: 60_000, // la gente se anota desde el celular
  });
  const clases = useQuery({ queryKey: ['clases'], queryFn: () => pedir<Clase[]>('/clases') });

  return (
    <div className={estilos.pagina}>
      <header className={estilos.encabezado}>
        <div>
          <h1 className="titulo-pagina">Clases</h1>
          <p className="texto-suave">
            Los socios se anotan desde el celular, hasta que empieza la clase.
          </p>
        </div>
        {esDueno && (
          <div className={estilos.acciones}>
            <button
              type="button"
              className="boton boton-principal"
              onClick={() => setEditando(null)}
            >
              <Plus size={18} aria-hidden /> Nueva clase
            </button>
          </div>
        )}
      </header>

      <section className={estilos.seccion} aria-labelledby="titulo-agenda">
        <h2 id="titulo-agenda" className={estilos.tituloSeccion}>
          Próximos 7 días
        </h2>
        {agenda.isPending && <p className="texto-suave">Cargando…</p>}
        {agenda.isError && <p className="alerta-error">{agenda.error.message}</p>}
        {agenda.data?.length === 0 && (
          <p className="texto-suave">No hay clases en los próximos días.</p>
        )}
        {agenda.data &&
          agruparPorFecha(agenda.data).map(([fecha, delDia]) => (
            <div key={fecha} className={propios.dia}>
              <h3 className={propios.tituloDia}>{tituloDeFecha(fecha)}</h3>
              <ul className={propios.lista}>
                {delDia.map((clase) => (
                  <li key={clase.claseId} className={propios.clase}>
                    <span className={`numero ${propios.hora}`}>{clase.horaInicio}</span>
                    <div className={propios.detalle}>
                      <strong>{clase.nombre}</strong>
                      <span className={propios.meta}>
                        {clase.duracionMinutos} min{clase.profesor && ` · ${clase.profesor}`}
                      </span>
                      {clase.socios && clase.socios.length > 0 && (
                        <details className={propios.anotados}>
                          <summary>Ver anotados</summary>
                          <ol>
                            {clase.socios.map((socio, i) => (
                              <li key={i}>
                                {socio.nombre} {socio.apellido}
                              </li>
                            ))}
                          </ol>
                        </details>
                      )}
                    </div>
                    <Lugares inscriptos={clase.inscriptos} cupo={clase.cupo} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </section>

      <section className={estilos.seccion} aria-labelledby="titulo-cronograma">
        <h2 id="titulo-cronograma" className={estilos.tituloSeccion}>
          Cronograma semanal
        </h2>
        {clases.data?.length === 0 && (
          <p className="texto-suave">
            {esDueno
              ? 'Todavía no hay clases. Creá la primera con “Nueva clase”.'
              : 'Todavía no hay clases cargadas.'}
          </p>
        )}
        {clases.data && clases.data.length > 0 && (
          <div className={tabla.contenedor}>
            <table className={tabla.tabla}>
              <thead>
                <tr>
                  <th scope="col">Clase</th>
                  <th scope="col">Día y hora</th>
                  <th scope="col" className={tabla.secundaria}>
                    Profe
                  </th>
                  <th scope="col" className={tabla.numero}>
                    Cupo
                  </th>
                  {esDueno && (
                    <th scope="col">
                      <span className="solo-lector">Acciones</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {clases.data.map((clase) => (
                  <tr key={clase.id}>
                    <td>
                      <strong>{clase.nombre}</strong>{' '}
                      {!clase.activa && <span className="etiqueta">Inactiva</span>}
                    </td>
                    <td>
                      {NOMBRES_DIA_SEMANA[clase.diaSemana]} {clase.horaInicio} (
                      {clase.duracionMinutos} min)
                    </td>
                    <td className={tabla.secundaria}>{clase.profesor?.nombre ?? '—'}</td>
                    <td className={`numero ${tabla.numero}`}>{clase.cupo}</td>
                    {esDueno && (
                      <td className={tabla.numero}>
                        <button
                          type="button"
                          className="boton boton-fantasma"
                          onClick={() => setEditando(clase)}
                        >
                          Editar
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {esDueno && (
        <Dialogo
          abierto={editando !== undefined}
          alCerrar={() => setEditando(undefined)}
          titulo={editando ? `Editar ${editando.nombre}` : 'Nueva clase'}
        >
          <FormularioClase
            key={editando?.id ?? 'nueva'}
            clase={editando ?? null}
            alTerminar={() => setEditando(undefined)}
          />
        </Dialogo>
      )}
    </div>
  );
}

/** "12/15" con una barrita: cuánto se llenó la clase. */
export function Lugares({ inscriptos, cupo }: { inscriptos: number; cupo: number }) {
  const llena = inscriptos >= cupo;
  return (
    <div className={propios.lugares} data-llena={llena}>
      <span className="numero">
        {inscriptos}/{cupo}
      </span>
      <span className={propios.barra} aria-hidden>
        <span style={{ width: `${Math.min(100, (inscriptos / cupo) * 100)}%` }} />
      </span>
      <span className={propios.meta}>{llena ? 'Llena' : `${cupo - inscriptos} libres`}</span>
    </div>
  );
}

interface PropsFormulario {
  clase: Clase | null;
  alTerminar: () => void;
}

/** Espera a tener los profes: si el <select> se arma sin opciones, pierde el valor inicial. */
function FormularioClase(props: PropsFormulario) {
  const profesores = useQuery({
    queryKey: ['clases', 'profesores'],
    queryFn: () => pedir<{ id: string; nombre: string }[]>('/clases/profesores'),
  });
  if (profesores.isError) return <p className="alerta-error">{profesores.error.message}</p>;
  if (!profesores.data) return <p className="texto-suave">Cargando…</p>;
  return <CamposClase {...props} profesores={profesores.data} />;
}

function CamposClase({
  clase,
  alTerminar,
  profesores,
}: PropsFormulario & { profesores: { id: string; nombre: string }[] }) {
  const clienteQuery = useQueryClient();
  const [activa, setActiva] = useState(clase?.activa ?? true);
  const [errorGeneral, setErrorGeneral] = useState<string>();

  const formulario = useForm<z.input<typeof esquemaCrearClase>, unknown, DatosCrearClase>({
    resolver: zodResolver(esquemaCrearClase),
    defaultValues: clase
      ? {
          nombre: clase.nombre,
          profesorId: clase.profesor?.id ?? null,
          diaSemana: clase.diaSemana,
          horaInicio: clase.horaInicio,
          duracionMinutos: clase.duracionMinutos,
          cupo: clase.cupo,
        }
      : { diaSemana: 1, horaInicio: '19:00', duracionMinutos: 60, cupo: 15, profesorId: null },
  });
  const { errors: errores, isSubmitting: enviando } = formulario.formState;

  const guardar = useMutation({
    mutationFn: (datos: DatosCrearClase) =>
      clase
        ? pedir<Clase>(`/clases/${clase.id}`, { metodo: 'PATCH', cuerpo: { ...datos, activa } })
        : pedir<Clase>('/clases', { metodo: 'POST', cuerpo: datos }),
    onSuccess: () => clienteQuery.invalidateQueries({ queryKey: ['clases'] }),
  });

  const enviar = formulario.handleSubmit(async (datos) => {
    try {
      await guardar.mutateAsync(datos);
      alTerminar();
    } catch (error) {
      setErrorGeneral(mostrarErrorEnFormulario(error, formulario.setError));
    }
  });

  return (
    <form className={estilos.formularioDialogo} onSubmit={enviar} noValidate>
      {errorGeneral && (
        <p className="alerta-error" role="alert">
          {errorGeneral}
        </p>
      )}
      <Campo
        etiqueta="Nombre"
        placeholder="Ej. Funcional"
        error={errores.nombre?.message}
        {...formulario.register('nombre')}
      />
      <Selector
        etiqueta="Profe"
        error={errores.profesorId?.message}
        // Un <select> siempre da un texto: "" lo convertimos en null (sin profe).
        {...formulario.register('profesorId', { setValueAs: (valor) => valor || null })}
      >
        <option value="">Sin asignar</option>
        {profesores.map((profe) => (
          <option key={profe.id} value={profe.id}>
            {profe.nombre}
          </option>
        ))}
      </Selector>
      <div className={estilos.grupo}>
        <Selector
          etiqueta="Día"
          error={errores.diaSemana?.message}
          {...formulario.register('diaSemana')}
        >
          {NOMBRES_DIA_SEMANA.slice(1).map((dia, i) => (
            <option key={dia} value={i + 1}>
              {dia}
            </option>
          ))}
        </Selector>
        <Campo
          etiqueta="Hora"
          type="time"
          error={errores.horaInicio?.message}
          {...formulario.register('horaInicio')}
        />
      </div>
      <div className={estilos.grupo}>
        <Campo
          etiqueta="Duración (min)"
          type="number"
          inputMode="numeric"
          error={errores.duracionMinutos?.message}
          {...formulario.register('duracionMinutos')}
        />
        <Campo
          etiqueta="Cupo"
          type="number"
          inputMode="numeric"
          error={errores.cupo?.message}
          {...formulario.register('cupo')}
        />
      </div>
      {clase && (
        <label className="casilla">
          <input
            type="checkbox"
            checked={activa}
            onChange={(evento) => setActiva(evento.target.checked)}
          />
          <span>
            Activa
            <small className="texto-suave">
              Una clase inactiva no aparece en la agenda ni acepta inscripciones.
            </small>
          </span>
        </label>
      )}
      <div className={estilos.botonera}>
        <button type="submit" className="boton boton-principal" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}
