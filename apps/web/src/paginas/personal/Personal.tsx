import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import {
  esquemaCrearPersonal,
  esquemaEditarPersonal,
  nombresDeRoles,
  NOMBRES_ROL,
  ROLES_PERSONAL,
  type DatosEditarPersonal,
  type Personal as DatosPersonal,
} from '@gimnasio/compartido';
import { pedir } from '../../api/cliente';
import { mostrarErrorEnFormulario } from '../../api/formularios';
import { Campo } from '../../componentes/Campo';
import { Dialogo } from '../../componentes/Dialogo';
import estilos from '../paginas.module.css';
import tabla from '../tabla.module.css';

/** Qué puede hacer cada rol, para que el dueño elija sin adivinar. */
const DESCRIPCION_ROL = {
  RECEPCION: 'Socios, cobros, clases y la pantalla de ingreso.',
  PROFESOR: 'Rutinas, plantillas y la agenda de clases.',
  KIOSCO: 'Solo la pantalla de ingreso (para la tablet de la entrada).',
} as const;

/** Personal del gimnasio: solo el dueño lo ve. */
export function Personal() {
  // undefined = cerrado; null = alta; un objeto = editar a esa persona.
  const [editando, setEditando] = useState<DatosPersonal | null>();
  const personal = useQuery({
    queryKey: ['personal'],
    queryFn: () => pedir<DatosPersonal[]>('/personal'),
  });

  return (
    <div className={estilos.pagina}>
      <header className={estilos.encabezado}>
        <div>
          <h1 className="titulo-pagina">Personal</h1>
          <p className="texto-suave">
            Quién trabaja en el gimnasio y qué puede hacer en el sistema.
          </p>
        </div>
        <div className={estilos.acciones}>
          <button type="button" className="boton boton-principal" onClick={() => setEditando(null)}>
            <Plus size={18} aria-hidden /> Agregar
          </button>
        </div>
      </header>

      {personal.isPending && <p className="texto-suave">Cargando…</p>}
      {personal.isError && <p className="alerta-error">{personal.error.message}</p>}
      {personal.data && (
        <div className={tabla.contenedor}>
          <table className={tabla.tabla}>
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Rol</th>
                <th scope="col" className={tabla.secundaria}>
                  Email
                </th>
                <th scope="col">
                  <span className="solo-lector">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {personal.data.map((persona) => (
                <tr key={persona.id}>
                  <td>
                    <strong>{persona.nombre}</strong>{' '}
                    {!persona.activo && <span className="etiqueta">Inactivo</span>}
                  </td>
                  <td>{nombresDeRoles(persona.roles)}</td>
                  <td className={tabla.secundaria}>{persona.email}</td>
                  <td className={tabla.numero}>
                    {persona.editable && (
                      <button
                        type="button"
                        className="boton boton-fantasma"
                        onClick={() => setEditando(persona)}
                      >
                        Editar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialogo
        abierto={editando !== undefined}
        alCerrar={() => setEditando(undefined)}
        titulo={editando ? `Editar a ${editando.nombre}` : 'Agregar personal'}
      >
        <FormularioPersonal
          key={editando?.id ?? 'nuevo'}
          persona={editando ?? null}
          alTerminar={() => setEditando(undefined)}
        />
      </Dialogo>
    </div>
  );
}

function FormularioPersonal({
  persona,
  alTerminar,
}: {
  persona: DatosPersonal | null;
  alTerminar: () => void;
}) {
  const clienteQuery = useQueryClient();
  const [errorGeneral, setErrorGeneral] = useState<string>();

  // Un solo formulario para alta y edición: en el alta la contraseña es obligatoria.
  const formulario = useForm<DatosEditarPersonal>({
    resolver: zodResolver(
      persona
        ? esquemaEditarPersonal
        : esquemaCrearPersonal.extend({ activo: esquemaEditarPersonal.shape.activo }),
    ),
    defaultValues: persona
      ? {
          nombre: persona.nombre,
          email: persona.email,
          // El dueño no llega acá (no es editable), así que sus roles son de personal.
          roles: persona.roles as DatosEditarPersonal['roles'],
          activo: persona.activo,
          contrasena: '',
        }
      : { nombre: '', email: '', roles: [], activo: true, contrasena: '' },
  });
  const { errors: errores, isSubmitting: enviando } = formulario.formState;
  const roles = useWatch({ control: formulario.control, name: 'roles' });
  const esPantalla = roles.includes('KIOSCO');

  const guardar = useMutation({
    mutationFn: (datos: DatosEditarPersonal) =>
      persona
        ? pedir<DatosPersonal>(`/personal/${persona.id}`, { metodo: 'PUT', cuerpo: datos })
        : pedir<DatosPersonal>('/personal', { metodo: 'POST', cuerpo: datos }),
    onSuccess: () => clienteQuery.invalidateQueries({ queryKey: ['personal'] }),
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
        autoComplete="off"
        error={errores.nombre?.message}
        {...formulario.register('nombre')}
      />
      <Campo
        etiqueta="Email"
        type="email"
        autoComplete="off"
        ayuda={
          esPantalla
            ? 'Para la tablet podés inventar uno, ej. ingreso@tugimnasio.com: solo sirve para entrar, nunca le mandamos mails.'
            : 'Es con lo que va a entrar al sistema.'
        }
        error={errores.email?.message}
        {...formulario.register('email')}
      />

      <fieldset className={estilos.grupoCasillas}>
        <legend>Rol</legend>
        {ROLES_PERSONAL.map((rol) => (
          <label key={rol} className="casilla">
            <input
              type="checkbox"
              value={rol}
              // La pantalla de ingreso va sola: si está marcada, se apagan las otras (y al revés).
              disabled={rol === 'KIOSCO' ? roles.some((r) => r !== 'KIOSCO') : esPantalla}
              {...formulario.register('roles')}
            />
            <span>
              {NOMBRES_ROL[rol]}
              <small className="texto-suave">{DESCRIPCION_ROL[rol]}</small>
            </span>
          </label>
        ))}
        {errores.roles && (
          <p className="campo-error" role="alert">
            {errores.roles.message ?? errores.roles.root?.message}
          </p>
        )}
      </fieldset>

      <Campo
        etiqueta={persona ? 'Nueva contraseña' : 'Contraseña'}
        type="password"
        autoComplete="new-password"
        ayuda={
          persona
            ? 'Dejala vacía para no cambiarla. Si la cambiás, se le cierra la sesión.'
            : 'Mínimo 8 caracteres. Pasásela en persona; después no se puede ver.'
        }
        error={errores.contrasena?.message}
        {...formulario.register('contrasena')}
      />

      {persona && (
        <label className="casilla">
          <input type="checkbox" {...formulario.register('activo')} />
          <span>
            Activo
            <small className="texto-suave">
              Si lo desactivás, no puede entrar más y se le cierra la sesión. Lo que hizo (cobros,
              rutinas) queda guardado.
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
