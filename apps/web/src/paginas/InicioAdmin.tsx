import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import type { GimnasioAdmin } from '@gimnasio/compartido';
import { pedir } from '../api/cliente';
import estilos from './paginas.module.css';
import tabla from './tabla.module.css';

export function InicioAdmin() {
  const gimnasios = useQuery({
    queryKey: ['admin', 'gimnasios'],
    queryFn: () => pedir<GimnasioAdmin[]>('/admin/gimnasios'),
  });

  return (
    <div className={estilos.pagina}>
      <header className={estilos.encabezado}>
        <div>
          <h1 className="titulo-pagina">Gimnasios</h1>
          <p className="texto-suave">Todos los gimnasios que usan GimnasioApp.</p>
        </div>
        <Link to="/admin/gimnasios/nuevo" className="boton boton-principal">
          <Plus size={18} aria-hidden />
          Nuevo gimnasio
        </Link>
      </header>

      {gimnasios.isPending && <p className="texto-suave">Cargando…</p>}
      {gimnasios.isError && <p className="alerta-error">{gimnasios.error.message}</p>}
      {gimnasios.data && (
        <div className={tabla.contenedor}>
          <table className={tabla.tabla}>
            <thead>
              <tr>
                <th scope="col">Gimnasio</th>
                <th scope="col">Código</th>
                <th scope="col" className={tabla.numero}>
                  Socios
                </th>
                <th scope="col" className={tabla.numero}>
                  Usuarios
                </th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {gimnasios.data.map((gimnasio) => (
                <tr key={gimnasio.id} className={tabla.filaEnlace}>
                  <td>
                    <span className={tabla.conMuestra}>
                      <span
                        className={tabla.muestra}
                        style={{ background: gimnasio.colorPrimario }}
                        aria-hidden="true"
                      />
                      <Link to={`/admin/gimnasios/${gimnasio.id}`} className={tabla.enlaceFila}>
                        <strong>{gimnasio.nombre}</strong>
                      </Link>
                    </span>
                  </td>
                  <td className="texto-suave">{gimnasio.slug}</td>
                  <td className={`numero ${tabla.numero}`}>{gimnasio.cantidadSocios}</td>
                  <td className={`numero ${tabla.numero}`}>{gimnasio.cantidadUsuarios}</td>
                  <td>{gimnasio.activo ? 'Activo' : 'Suspendido'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
