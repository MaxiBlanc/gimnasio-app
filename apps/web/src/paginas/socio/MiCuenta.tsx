import { useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Dumbbell, House, LogOut } from 'lucide-react';
import {
  NOMBRES_ESTADO_CUOTA,
  NOMBRES_FORMA_PAGO,
  type EstadoCuota,
  type MiCuenta as DatosMiCuenta,
  type UsuarioSesion,
} from '@gimnasio/compartido';
import { pedir } from '../../api/cliente';
import { BotonTema } from '../../componentes/BotonTema';
import { Ocupacion } from '../../componentes/Ocupacion';
import {
  formatearFecha,
  formatearFechaHora,
  formatearPeriodo,
  formatearPesos,
} from '../../formato';
import { useSesion } from '../../sesion/sesion';
import { aplicarMarca, MARCA_APP } from '../../tema/marca';
import estilos from './MiCuenta.module.css';
import { MisClases } from './MisClases';
import { MisRutinas } from './MisRutinas';

export type SeccionSocio = 'inicio' | 'rutinas' | 'clases';

const SECCIONES = [
  { seccion: 'inicio', ruta: '/socio', etiqueta: 'Inicio', Icono: House },
  { seccion: 'rutinas', ruta: '/socio/rutinas', etiqueta: 'Rutinas', Icono: Dumbbell },
  { seccion: 'clases', ruta: '/socio/clases', etiqueta: 'Clases', Icono: CalendarDays },
] as const;

/** Una frase que explica el estado, en vez de solo la etiqueta. */
function explicacion(estado: EstadoCuota, vencimiento: string | null): string {
  const hasta = vencimiento ? formatearFecha(vencimiento) : null;
  switch (estado) {
    case 'AL_DIA':
      return `Tenés pago hasta el ${hasta}.`;
    case 'POR_VENCER':
      return `Tenés pago hasta el ${hasta}. Acordate de renovar.`;
    case 'PENDIENTE':
      return 'Todavía no pagaste este mes. Podés hacerlo en recepción.';
    case 'VENCIDO':
      return 'Tu cuota de este mes está vencida. Acercate a recepción.';
  }
}

/** Pantalla principal del socio, pensada para el celular. */
export function MiCuenta({ usuario, seccion }: { usuario: UsuarioSesion; seccion: SeccionSocio }) {
  const { salir } = useSesion();
  const navegar = useNavigate();
  const gimnasio = usuario.gimnasio;

  useEffect(() => aplicarMarca(gimnasio ?? MARCA_APP), [gimnasio]);

  const cerrarSesion = async () => {
    await salir();
    void navegar(gimnasio ? `/g/${gimnasio.slug}/socio` : '/', { replace: true });
  };

  return (
    <div className={estilos.pantalla}>
      <header className={estilos.barra}>
        {gimnasio?.logoUrl ? (
          <img className={estilos.logo} src={gimnasio.logoUrl} alt={gimnasio.nombre} />
        ) : (
          <span className={`titular ${estilos.nombreGimnasio}`}>{gimnasio?.nombre}</span>
        )}
        <div className={estilos.acciones}>
          <BotonTema />
          <button
            type="button"
            className="boton boton-fantasma boton-icono"
            onClick={cerrarSesion}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogOut size={18} aria-hidden />
          </button>
        </div>
      </header>

      <main className={estilos.contenido}>
        {seccion === 'rutinas' && <MisRutinas />}
        {seccion === 'clases' && <MisClases />}
        {seccion === 'inicio' && <InicioSocio nombre={usuario.nombre} />}
      </main>

      <nav className={estilos.navegacion} aria-label="Secciones">
        {SECCIONES.map(({ seccion: s, ruta, etiqueta, Icono }) => (
          <NavLink key={s} to={ruta} end className={estilos.pestana}>
            <Icono size={22} aria-hidden />
            {etiqueta}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/** Inicio: el estado de la cuota, cuánta gente hay y los pagos. */
function InicioSocio({ nombre }: { nombre: string }) {
  const cuenta = useQuery({
    queryKey: ['mi-cuenta'],
    queryFn: () => pedir<DatosMiCuenta>('/mi-cuenta'),
  });

  return (
    <>
      <h1 className="titulo-pagina">Hola, {cuenta.data?.nombre ?? nombre.split(' ')[0]}</h1>

      {cuenta.isPending && <p className="texto-suave">Cargando tu cuenta…</p>}
      {cuenta.isError && (
        <p className="alerta-error" role="alert">
          {cuenta.error.message}
        </p>
      )}

      {cuenta.data && (
        <>
          <section
            className={estilos.cuota}
            data-estado={cuenta.data.cuota.estado}
            aria-labelledby="titulo-cuota"
          >
            <h2 id="titulo-cuota" className={estilos.etiqueta}>
              Tu cuota
            </h2>
            <p className={`titular ${estilos.estado}`}>
              {NOMBRES_ESTADO_CUOTA[cuenta.data.cuota.estado]}
            </p>
            <p className={estilos.detalle}>
              {explicacion(cuenta.data.cuota.estado, cuenta.data.cuota.vencimiento)}
            </p>
            <p className={estilos.plan}>
              {cuenta.data.plan.nombre} · {formatearPesos(cuenta.data.plan.precio)}
              {cuenta.data.descuento && ` · ${cuenta.data.descuento}`}
            </p>
          </section>

          <Ocupacion />

          <section className={estilos.visitas}>
            <span className={`numero ${estilos.cifra}`}>{cuenta.data.ingresosDelMes}</span>
            <span>{cuenta.data.ingresosDelMes === 1 ? 'visita' : 'visitas'} este mes</span>
          </section>

          <section aria-labelledby="titulo-pagos">
            <h2 id="titulo-pagos" className={estilos.etiqueta}>
              Tus pagos
            </h2>
            {cuenta.data.pagos.length === 0 ? (
              <p className="texto-suave">Todavía no hay pagos registrados.</p>
            ) : (
              <ul className={estilos.pagos}>
                {cuenta.data.pagos.map((pago) => (
                  <li key={pago.id} className={estilos.pago}>
                    <div>
                      <strong className={estilos.capitalizar}>
                        {formatearPeriodo(pago.periodoDesde, pago.periodoHasta)}
                      </strong>
                      <span className={estilos.fecha}>
                        {formatearFechaHora(pago.fecha)} · {NOMBRES_FORMA_PAGO[pago.formaPago]}
                      </span>
                    </div>
                    <span className="numero">{formatearPesos(pago.montoFinal)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}
