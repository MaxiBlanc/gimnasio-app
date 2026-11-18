import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import type { ResumenRutina, Rutina } from '@gimnasio/compartido';
import { pedir } from '../../api/cliente';
import { Selector } from '../../componentes/Selector';
import { formatearFechaHora } from '../../formato';
import estilos from '../paginas.module.css';
import propios from './rutinas.module.css';

/** Sección de la ficha del socio (para el profe y el dueño): sus rutinas y asignar una nueva. */
export function RutinasDelSocio({ socioId }: { socioId: string }) {
  const clienteQuery = useQueryClient();
  const [plantillaId, setPlantillaId] = useState('');

  const rutinas = useQuery({
    queryKey: ['rutinas', 'socio', socioId],
    queryFn: () => pedir<Rutina[]>(`/socios/${socioId}/rutinas`),
  });
  const plantillas = useQuery({
    queryKey: ['rutinas', 'plantillas'],
    queryFn: () => pedir<ResumenRutina[]>('/rutinas/plantillas'),
  });

  const asignar = useMutation({
    mutationFn: () =>
      pedir<Rutina>(`/socios/${socioId}/rutinas`, { metodo: 'POST', cuerpo: { plantillaId } }),
    onSuccess: async () => {
      setPlantillaId('');
      await clienteQuery.invalidateQueries({ queryKey: ['rutinas', 'socio', socioId] });
    },
  });

  return (
    <section className={estilos.seccion} aria-labelledby="titulo-rutinas">
      <div className={estilos.encabezadoSeccion}>
        <h2 id="titulo-rutinas" className={estilos.tituloSeccion}>
          Rutinas
        </h2>
        <Link className="boton boton-secundario" to={`/panel/socios/${socioId}/rutinas/nueva`}>
          <Plus size={18} aria-hidden /> Armar desde cero
        </Link>
      </div>

      {plantillas.data && plantillas.data.length > 0 && (
        <form
          className={estilos.formulario}
          onSubmit={(evento) => {
            evento.preventDefault();
            if (plantillaId) asignar.mutate();
          }}
        >
          <div className={estilos.grupo}>
            <Selector
              etiqueta="Asignar una plantilla"
              value={plantillaId}
              onChange={(evento) => setPlantillaId(evento.target.value)}
              ayuda="Se crea una copia para este socio: después la podés ajustar."
            >
              <option value="">Elegí una plantilla…</option>
              {plantillas.data.map((plantilla) => (
                <option key={plantilla.id} value={plantilla.id}>
                  {plantilla.nombre}
                </option>
              ))}
            </Selector>
          </div>
          <div>
            <button
              type="submit"
              className="boton boton-principal"
              disabled={!plantillaId || asignar.isPending}
            >
              {asignar.isPending ? 'Asignando…' : 'Asignar'}
            </button>
          </div>
          {asignar.isError && <p className="alerta-error">{asignar.error.message}</p>}
        </form>
      )}

      {rutinas.isError && <p className="alerta-error">{rutinas.error.message}</p>}
      {rutinas.data?.length === 0 && (
        <p className="texto-suave">Todavía no tiene rutinas asignadas.</p>
      )}
      {rutinas.data && rutinas.data.length > 0 && (
        <ul className={propios.tarjetas}>
          {rutinas.data.map((rutina) => (
            <li key={rutina.id}>
              <Link className={propios.tarjeta} to={`/panel/rutinas/${rutina.id}`}>
                <span className={propios.nombre}>{rutina.nombre}</span>
                <span className={propios.meta}>
                  {rutina.dias.length} {rutina.dias.length === 1 ? 'día' : 'días'} · por{' '}
                  {rutina.creadaPor.nombre} · {formatearFechaHora(rutina.actualizadoEn)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
