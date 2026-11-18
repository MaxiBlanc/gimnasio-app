import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Trash2 } from 'lucide-react';
import type { DatosGuardarRutina, Rutina } from '@gimnasio/compartido';
import { pedir } from '../../api/cliente';
import estilos from '../paginas.module.css';
import { EditorRutina } from './EditorRutina';

/**
 * Una sola pantalla para tres casos (según la URL):
 *   /panel/rutinas/nueva                → plantilla nueva
 *   /panel/socios/:socioId/rutinas/nueva → rutina nueva para un socio
 *   /panel/rutinas/:id                  → editar una plantilla o la rutina de un socio
 */
export function EditarRutina() {
  const { id, socioId } = useParams();
  const navegar = useNavigate();
  const clienteQuery = useQueryClient();
  const [errorBorrar, setErrorBorrar] = useState<string>();

  const rutina = useQuery({
    queryKey: ['rutinas', id],
    queryFn: () => pedir<Rutina>(`/rutinas/${id}`),
    enabled: Boolean(id),
  });

  // A dónde volver: a la ficha del socio si la rutina es de un socio; si no, a las plantillas.
  const socioDeLaRutina = socioId ?? rutina.data?.socioId ?? null;
  const volverA = socioDeLaRutina ? `/panel/socios/${socioDeLaRutina}` : '/panel/rutinas';

  const alTerminar = async () => {
    // Todo lo que empieza con 'rutinas' queda viejo (listas, la rutina, las del socio).
    await clienteQuery.invalidateQueries({ queryKey: ['rutinas'] });
    void navegar(volverA);
  };

  const guardar = async (datos: DatosGuardarRutina) => {
    if (id) await pedir(`/rutinas/${id}`, { metodo: 'PUT', cuerpo: datos });
    else if (socioId) await pedir(`/socios/${socioId}/rutinas`, { metodo: 'POST', cuerpo: datos });
    else await pedir('/rutinas/plantillas', { metodo: 'POST', cuerpo: datos });
    await alTerminar();
  };

  const borrar = useMutation({
    mutationFn: () => pedir(`/rutinas/${id}`, { metodo: 'DELETE' }),
    onSuccess: alTerminar,
    onError: (error) => setErrorBorrar(error.message),
  });

  const titulo = id
    ? rutina.data?.socioId
      ? 'Rutina del socio'
      : 'Plantilla'
    : socioId
      ? 'Nueva rutina para el socio'
      : 'Nueva plantilla';

  if (id && rutina.isPending) return <p className="texto-suave">Cargando…</p>;
  if (id && rutina.isError) return <p className="alerta-error">{rutina.error.message}</p>;

  return (
    <div className={estilos.pagina}>
      <Link className={estilos.volver} to={volverA}>
        <ArrowLeft size={16} aria-hidden /> Volver
      </Link>
      <header className={estilos.encabezado}>
        <h1 className="titulo-pagina">{titulo}</h1>
        {id && (
          <div className={estilos.acciones}>
            <button
              type="button"
              className="boton boton-peligro"
              disabled={borrar.isPending}
              onClick={() => {
                if (window.confirm('¿Borrar esta rutina? No se puede deshacer.')) borrar.mutate();
              }}
            >
              <Trash2 size={18} aria-hidden /> Borrar
            </button>
          </div>
        )}
      </header>
      {errorBorrar && <p className="alerta-error">{errorBorrar}</p>}

      <EditorRutina
        // La key fuerza un formulario nuevo cuando llegan los datos (defaultValues se leen una vez).
        key={rutina.data?.id ?? 'nueva'}
        inicial={rutina.data}
        textoBoton={id ? 'Guardar cambios' : 'Crear rutina'}
        alGuardar={guardar}
      />
    </div>
  );
}
