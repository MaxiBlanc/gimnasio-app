import { useQuery } from '@tanstack/react-query';
import type { Tablero as DatosTablero } from '@gimnasio/compartido';
import { pedir } from '../../api/cliente';
import { Barras } from '../../componentes/Barras';
import { formatearPesos } from '../../formato';
import estilos from './Tablero.module.css';

const diaCorto = new Intl.DateTimeFormat('es-AR', { weekday: 'narrow', timeZone: 'UTC' });
const diaLargo = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  timeZone: 'UTC',
});
/** Horario en el que suele abrir un gimnasio: no mostramos la madrugada vacía. */
const PRIMERA_HORA = 6;

const entradas = (n: number) => `${n} ${n === 1 ? 'entrada' : 'entradas'}`;
const promedio = (n: number) =>
  `${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })} por día`;

/** Variación contra el mes anterior: "+12 %", o null si el mes anterior fue 0. */
function variacion(actual: number, anterior: number): string | null {
  if (anterior === 0) return null;
  const porcentaje = Math.round(((actual - anterior) / anterior) * 100);
  return `${porcentaje > 0 ? '+' : ''}${porcentaje} %`;
}

/** Números del gimnasio para el dueño. */
export function Tablero() {
  const consulta = useQuery({
    queryKey: ['tablero'],
    queryFn: () => pedir<DatosTablero>('/tablero'),
  });

  if (consulta.isPending) return <p className="texto-suave">Cargando números…</p>;
  if (consulta.isError) return <p className="alerta-error">{consulta.error.message}</p>;

  const t = consulta.data;
  const cambio = variacion(t.cobrado.mesActual, t.cobrado.mesAnterior);
  const ultimoDia = t.ingresosPorDia.length - 1;

  return (
    <div className={estilos.tablero}>
      <div className={estilos.cifras}>
        <div className={estilos.cifra}>
          <span className={estilos.rotulo}>Cobrado este mes</span>
          <span className={`numero ${estilos.valor}`}>{formatearPesos(t.cobrado.mesActual)}</span>
          <span className={estilos.nota}>
            Mes pasado: {formatearPesos(t.cobrado.mesAnterior)}
            {cambio && ` (${cambio})`}
          </span>
        </div>
        <div className={estilos.cifra}>
          <span className={estilos.rotulo}>Socios activos</span>
          <span className={`numero ${estilos.valor}`}>{t.sociosActivos}</span>
          <span className={estilos.nota}>
            {t.altasDelMes} {t.altasDelMes === 1 ? 'alta' : 'altas'} este mes
          </span>
        </div>
        <div className={estilos.cifra}>
          <span className={estilos.rotulo}>Entradas hoy</span>
          <span className={`numero ${estilos.valor}`}>{t.ingresos.hoy}</span>
          <span className={estilos.nota}>{entradas(t.ingresos.ultimos7Dias)} en 7 días</span>
        </div>
      </div>

      <div className={estilos.graficos}>
        <Barras
          titulo="Entradas por día (últimas 2 semanas)"
          formatear={entradas}
          barras={t.ingresosPorDia.map((dia, i) => {
            const fecha = new Date(`${dia.fecha}T00:00:00Z`);
            return {
              etiqueta: diaCorto.format(fecha).toUpperCase(),
              detalle: i === ultimoDia ? `Hoy, ${diaLargo.format(fecha)}` : diaLargo.format(fecha),
              valor: dia.cantidad,
              destacada: i === ultimoDia,
            };
          })}
        />
        <Barras
          titulo="¿A qué hora viene la gente? (promedio, últimas 4 semanas)"
          formatear={promedio}
          barras={t.ingresosPorHora.slice(PRIMERA_HORA).map(({ hora, promedio: valor }) => ({
            // Una etiqueta cada 3 horas, para que no se amontonen.
            etiqueta: hora % 3 === 0 ? `${hora}h` : '',
            detalle: `De ${hora} a ${hora + 1} h`,
            valor,
          }))}
        />
      </div>
    </div>
  );
}
