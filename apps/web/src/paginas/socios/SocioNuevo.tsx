import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import type { Socio } from '@gimnasio/compartido';
import { pedir } from '../../api/cliente';
import estilos from '../paginas.module.css';
import { FormularioSocio } from './FormularioSocio';

export function SocioNuevo() {
  return (
    <div className={estilos.pagina}>
      <header>
        <Link to="/panel/socios" className={estilos.volver}>
          <ChevronLeft size={18} aria-hidden /> Socios
        </Link>
        <h1 className="titulo-pagina">Nuevo socio</h1>
      </header>
      <FormularioSocio />
    </div>
  );
}

export function SocioEditar() {
  const { id = '' } = useParams();
  const socio = useQuery({
    queryKey: ['socios', 'ficha', id],
    queryFn: () => pedir<Socio>(`/socios/${id}`),
  });

  return (
    <div className={estilos.pagina}>
      <header>
        <Link to={`/panel/socios/${id}`} className={estilos.volver}>
          <ChevronLeft size={18} aria-hidden /> Volver a la ficha
        </Link>
        <h1 className="titulo-pagina">
          {socio.data ? `Editar a ${socio.data.nombre} ${socio.data.apellido}` : 'Editar socio'}
        </h1>
      </header>
      {socio.isPending && <p className="texto-suave">Cargando…</p>}
      {socio.isError && <p className="alerta-error">{socio.error.message}</p>}
      {/* key: si cambia el socio, el formulario arranca de cero con sus datos. */}
      {socio.data && <FormularioSocio key={socio.data.id} socio={socio.data} />}
    </div>
  );
}
