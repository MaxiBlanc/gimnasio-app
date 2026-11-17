import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import {
  ESTADOS_CUOTA,
  NOMBRES_ESTADO_CUOTA,
  type EstadoCuota as Estado,
  type Pagina,
  type ResumenCuotas,
  type Socio,
} from '@gimnasio/compartido';
import { pedir } from '../../api/cliente';
import { EstadoCuota } from '../../componentes/EstadoCuota';
import { formatearFecha } from '../../formato';
import { useSesion } from '../../sesion/sesion';
import estilos from '../paginas.module.css';
import tabla from '../tabla.module.css';
import propios from './SociosLista.module.css';

const POR_PAGINA = 20;

/**
 * Listado de socios. Los filtros viven en la URL (?busqueda=lopez&estado=VENCIDO&pagina=2):
 * así se puede recargar, volver atrás desde la ficha o compartir el link sin perderlos.
 */
export function SociosLista() {
  const { usuario } = useSesion();
  const puedeEditar = usuario?.rol === 'DUENO' || usuario?.rol === 'RECEPCION';
  const [parametros, setParametros] = useSearchParams();

  const busqueda = parametros.get('busqueda') ?? '';
  const estado = (parametros.get('estado') ?? '') as Estado | '';
  const pagina = Math.max(1, Number(parametros.get('pagina')) || 1);
  const incluirBajas = parametros.get('incluirBajas') === 'true';

  const cambiarFiltro = (cambios: Record<string, string | null>) => {
    setParametros(
      (anteriores) => {
        const nuevos = new URLSearchParams(anteriores);
        for (const [clave, valor] of Object.entries(cambios)) {
          if (valor) nuevos.set(clave, valor);
          else nuevos.delete(clave);
        }
        if (!('pagina' in cambios)) nuevos.delete('pagina'); // filtro nuevo = volver a la página 1
        return nuevos;
      },
      { replace: true },
    );
  };

  // La búsqueda se aplica cuando el usuario deja de escribir (300 ms), no en cada tecla.
  const [textoBusqueda, setTextoBusqueda] = useState(busqueda);
  useEffect(() => {
    if (textoBusqueda.trim() === busqueda) return;
    const temporizador = setTimeout(() => cambiarFiltro({ busqueda: textoBusqueda.trim() }), 300);
    return () => clearTimeout(temporizador);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo reacciona al texto escrito
  }, [textoBusqueda]);

  const consulta = new URLSearchParams({ pagina: String(pagina), porPagina: String(POR_PAGINA) });
  if (busqueda) consulta.set('busqueda', busqueda);
  if (estado) consulta.set('estado', estado);
  if (incluirBajas) consulta.set('incluirBajas', 'true');

  const socios = useQuery({
    queryKey: ['socios', 'lista', consulta.toString()],
    queryFn: () => pedir<Pagina<Socio>>(`/socios?${consulta}`),
    placeholderData: keepPreviousData, // mientras carga la página 2, se sigue viendo la 1
  });

  const resumen = useQuery({
    queryKey: ['socios', 'resumen-cuotas'],
    queryFn: () => pedir<ResumenCuotas>('/socios/resumen-cuotas'),
    enabled: puedeEditar,
  });

  const totalPaginas = socios.data ? Math.max(1, Math.ceil(socios.data.total / POR_PAGINA)) : 1;

  return (
    <div className={estilos.pagina}>
      <header className={estilos.encabezado}>
        <div>
          <h1 className="titulo-pagina">Socios</h1>
          <p className="texto-suave">
            {socios.data
              ? `${socios.data.total} ${socios.data.total === 1 ? 'socio' : 'socios'}`
              : ' '}
          </p>
        </div>
        {puedeEditar && (
          <Link to="/panel/socios/nuevo" className="boton boton-principal">
            <Plus size={18} aria-hidden />
            Nuevo socio
          </Link>
        )}
      </header>

      <div className={propios.filtros}>
        <div className={propios.buscador}>
          <Search size={18} aria-hidden className={propios.lupa} />
          <label htmlFor="buscar-socio" className="solo-lector">
            Buscar por nombre, apellido o DNI
          </label>
          <input
            id="buscar-socio"
            type="search"
            placeholder="Buscar por nombre, apellido o DNI"
            value={textoBusqueda}
            onChange={(evento) => setTextoBusqueda(evento.target.value)}
          />
        </div>

        <div className={propios.estados} role="group" aria-label="Filtrar por estado de la cuota">
          <button
            type="button"
            className={propios.chip}
            aria-pressed={estado === ''}
            onClick={() => cambiarFiltro({ estado: null })}
          >
            Todos
          </button>
          {ESTADOS_CUOTA.map((opcion) => (
            <button
              key={opcion}
              type="button"
              className={propios.chip}
              data-estado={opcion}
              aria-pressed={estado === opcion}
              onClick={() => cambiarFiltro({ estado: estado === opcion ? null : opcion })}
            >
              {NOMBRES_ESTADO_CUOTA[opcion]}
              {resumen.data && <span className="numero">{resumen.data[opcion]}</span>}
            </button>
          ))}
        </div>

        <label className={propios.bajas}>
          <input
            type="checkbox"
            checked={incluirBajas}
            onChange={(evento) =>
              cambiarFiltro({ incluirBajas: evento.target.checked ? 'true' : null })
            }
          />
          Mostrar dados de baja
        </label>
      </div>

      {socios.isError && <p className="alerta-error">{socios.error.message}</p>}

      {socios.data && (
        <div className={tabla.contenedor} aria-busy={socios.isFetching}>
          {socios.data.datos.length === 0 ? (
            <p className={estilos.vacio}>
              {busqueda || estado
                ? 'Ningún socio coincide con la búsqueda.'
                : 'Todavía no hay socios. Cargá el primero con “Nuevo socio”.'}
            </p>
          ) : (
            <table className={tabla.tabla}>
              <thead>
                <tr>
                  <th scope="col">Socio</th>
                  <th scope="col" className={tabla.secundaria}>
                    DNI
                  </th>
                  <th scope="col" className={tabla.secundaria}>
                    Plan
                  </th>
                  <th scope="col">Cuota</th>
                  <th scope="col" className={tabla.secundaria}>
                    Pagado hasta
                  </th>
                </tr>
              </thead>
              <tbody>
                {socios.data.datos.map((socio) => (
                  <tr key={socio.id} className={tabla.filaEnlace}>
                    <td>
                      <Link to={`/panel/socios/${socio.id}`} className={tabla.enlaceFila}>
                        <strong>
                          {socio.apellido}, {socio.nombre}
                        </strong>
                      </Link>
                      {!socio.activo && <span className="etiqueta"> Baja</span>}
                      <span className={`texto-suave ${tabla.soloCelular}`}>DNI {socio.dni}</span>
                    </td>
                    <td className={`numero ${tabla.secundaria}`}>{socio.dni}</td>
                    <td className={tabla.secundaria}>{socio.plan.nombre}</td>
                    <td>
                      <EstadoCuota estado={socio.cuota.estado} />
                    </td>
                    <td className={`numero ${tabla.secundaria}`}>
                      {socio.cuota.vencimiento ? (
                        formatearFecha(socio.cuota.vencimiento)
                      ) : (
                        <span className="texto-suave">Nunca pagó</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {totalPaginas > 1 && (
        <nav className={propios.paginado} aria-label="Páginas">
          <button
            type="button"
            className="boton boton-secundario boton-icono"
            disabled={pagina <= 1}
            onClick={() => cambiarFiltro({ pagina: String(pagina - 1) })}
            aria-label="Página anterior"
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <span className="numero">
            Página {pagina} de {totalPaginas}
          </span>
          <button
            type="button"
            className="boton boton-secundario boton-icono"
            disabled={pagina >= totalPaginas}
            onClick={() => cambiarFiltro({ pagina: String(pagina + 1) })}
            aria-label="Página siguiente"
          >
            <ChevronRight size={18} aria-hidden />
          </button>
        </nav>
      )}
    </div>
  );
}
