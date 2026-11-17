import { useQuery } from '@tanstack/react-query';
import type { ResumenCuotas as Resumen } from '@gimnasio/compartido';
import { pedir } from '../api/cliente';
import { ResumenCuotas } from '../componentes/ResumenCuotas';
import { useSesion } from '../sesion/sesion';
import estilos from './paginas.module.css';

const fechaDeHoy = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'America/Argentina/Buenos_Aires',
});

export function InicioPanel() {
  const { usuario } = useSesion();
  const veCuotas = usuario?.rol === 'DUENO' || usuario?.rol === 'RECEPCION';

  const resumen = useQuery({
    queryKey: ['socios', 'resumen-cuotas'],
    queryFn: () => pedir<Resumen>('/socios/resumen-cuotas'),
    enabled: veCuotas,
  });

  const primerNombre = usuario?.nombre.split(' ')[0];

  return (
    <div className={estilos.pagina}>
      <header className={estilos.encabezado}>
        <div>
          <h1 className="titulo-pagina">Hola, {primerNombre}</h1>
          <p className={`texto-suave ${estilos.fecha}`}>{fechaDeHoy.format(new Date())}</p>
        </div>
      </header>

      {veCuotas && (
        <section className={estilos.seccion} aria-labelledby="titulo-cuotas">
          <h2 id="titulo-cuotas" className={estilos.tituloSeccion}>
            Cuotas de este mes
          </h2>
          {resumen.isPending && <p className="texto-suave">Cargando…</p>}
          {resumen.isError && <p className="alerta-error">{resumen.error.message}</p>}
          {resumen.data && <ResumenCuotas resumen={resumen.data} />}
        </section>
      )}

      {usuario?.rol === 'PROFESOR' && (
        <p className="texto-suave">Desde acá vas a poder ver a los socios y armar sus rutinas.</p>
      )}
      {usuario?.rol === 'KIOSCO' && (
        <p className="texto-suave">
          Este usuario es para la tablet de la entrada. La pantalla de ingreso por DNI llega en la
          etapa 2.
        </p>
      )}
    </div>
  );
}
