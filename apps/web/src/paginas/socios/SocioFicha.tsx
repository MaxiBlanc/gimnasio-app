import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Pencil, Wallet } from 'lucide-react';
import {
  tieneRol,
  NOMBRES_ESTADO_CUOTA,
  NOMBRES_FORMA_PAGO,
  type Pago,
  type Socio,
} from '@gimnasio/compartido';
import { pedir } from '../../api/cliente';
import { mensajeDeError } from '../../api/formularios';
import { Dialogo } from '../../componentes/Dialogo';
import { EstadoCuota } from '../../componentes/EstadoCuota';
import {
  formatearFecha,
  formatearFechaHora,
  formatearPeriodo,
  formatearPesos,
} from '../../formato';
import { useSesion } from '../../sesion/sesion';
import estilos from '../paginas.module.css';
import tabla from '../tabla.module.css';
import { DialogoCobro } from './DialogoCobro';
import { RutinasDelSocio } from '../rutinas/RutinasDelSocio';
import propios from './SocioFicha.module.css';

const AVISOS: Record<string, { texto: string; clase: string }> = {
  alta: {
    texto: 'Socio dado de alta. Le mandamos el mail para crear su cuenta.',
    clase: 'alerta-ok',
  },
  'alta-sin-correo': {
    texto: 'Socio dado de alta, pero el mail no se pudo enviar. Probá reenviarlo más tarde.',
    clase: 'alerta-aviso',
  },
  editado: { texto: 'Cambios guardados.', clase: 'alerta-ok' },
  cobrado: { texto: 'Pago registrado.', clase: 'alerta-ok' },
  anulado: { texto: 'Pago anulado.', clase: 'alerta-ok' },
  correo: { texto: 'Mail de activación reenviado.', clase: 'alerta-ok' },
  'correo-fallo': { texto: 'No se pudo enviar el mail. Probá más tarde.', clase: 'alerta-aviso' },
  baja: { texto: 'Socio dado de baja. Se cerraron sus sesiones en la app.', clase: 'alerta-ok' },
  reactivado: { texto: 'Socio reactivado.', clase: 'alerta-ok' },
};

const DESCRIPCION_ESTADO = {
  AL_DIA: 'Pagó este mes.',
  POR_VENCER: 'Pagó este mes; el próximo todavía no.',
  PENDIENTE: 'Todavía no pagó este mes, pero está en término.',
  VENCIDO: 'No pagó este mes y ya pasó el día de cierre.',
} as const;

export function SocioFicha() {
  const { id = '' } = useParams();
  const ubicacion = useLocation();
  const { usuario } = useSesion();
  const clienteQuery = useQueryClient();
  const puedeEditar = usuario ? tieneRol(usuario, 'DUENO', 'RECEPCION') : false;
  const esDueno = usuario ? tieneRol(usuario, 'DUENO') : false;
  const armaRutinas = usuario ? tieneRol(usuario, 'DUENO', 'PROFESOR') : false;

  const [aviso, setAviso] = useState<string | undefined>(
    (ubicacion.state as { aviso?: string } | null)?.aviso,
  );
  const [cobrando, setCobrando] = useState(false);
  const [pagoAAnular, setPagoAAnular] = useState<Pago | null>(null);
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);

  const socio = useQuery({
    queryKey: ['socios', 'ficha', id],
    queryFn: () => pedir<Socio>(`/socios/${id}`),
  });
  const pagos = useQuery({
    queryKey: ['socios', 'ficha', id, 'pagos'],
    queryFn: () => pedir<Pago[]>(`/socios/${id}/pagos`),
    enabled: puedeEditar,
  });

  const reenviar = useMutation({
    mutationFn: () =>
      pedir<{ correoEnviado: boolean }>(`/socios/${id}/reenviar-activacion`, { metodo: 'POST' }),
    onSuccess: ({ correoEnviado }) => setAviso(correoEnviado ? 'correo' : 'correo-fallo'),
  });

  const cambiarActivo = useMutation({
    mutationFn: (activo: boolean) =>
      pedir<Socio>(`/socios/${id}`, { metodo: 'PATCH', cuerpo: { activo } }),
    onSuccess: async (editado) => {
      await clienteQuery.invalidateQueries({ queryKey: ['socios'] });
      setConfirmandoBaja(false);
      setAviso(editado.activo ? 'reactivado' : 'baja');
    },
  });

  if (socio.isPending) return <p className="texto-suave">Cargando…</p>;
  if (socio.isError) {
    return (
      <div className={estilos.pagina}>
        <p className="alerta-error">{socio.error.message}</p>
        <Link to="/panel/socios" className="boton boton-secundario">
          Volver a socios
        </Link>
      </div>
    );
  }

  const s = socio.data;
  const avisoActual = aviso ? AVISOS[aviso] : undefined;

  return (
    <div className={estilos.pagina}>
      <header className={estilos.encabezado}>
        <div>
          <Link to="/panel/socios" className={estilos.volver}>
            <ChevronLeft size={18} aria-hidden /> Socios
          </Link>
          <div className={propios.titulo}>
            <h1 className="titulo-pagina">
              {s.nombre} {s.apellido}
            </h1>
            {!s.activo && <span className="etiqueta">Dado de baja</span>}
          </div>
        </div>
        {puedeEditar && (
          <div className={estilos.acciones}>
            {s.activo && (
              <button
                type="button"
                className="boton boton-principal"
                onClick={() => setCobrando(true)}
              >
                <Wallet size={18} aria-hidden />
                Cobrar cuota
              </button>
            )}
            <Link to={`/panel/socios/${s.id}/editar`} className="boton boton-secundario">
              <Pencil size={16} aria-hidden />
              Editar
            </Link>
          </div>
        )}
      </header>

      {avisoActual && (
        <p className={avisoActual.clase} role="status">
          {avisoActual.texto}
        </p>
      )}

      <div className={propios.franja} data-estado={s.cuota.estado}>
        <div>
          <EstadoCuota estado={s.cuota.estado} />
          <p>{DESCRIPCION_ESTADO[s.cuota.estado]}</p>
        </div>
        <p>
          {s.cuota.vencimiento ? (
            <>
              Pagado hasta el{' '}
              <strong className="numero">{formatearFecha(s.cuota.vencimiento)}</strong>
            </>
          ) : (
            <strong>Nunca pagó</strong>
          )}
        </p>
      </div>

      <section className={estilos.seccion} aria-labelledby="titulo-datos">
        <h2 id="titulo-datos" className={estilos.tituloSeccion}>
          Datos
        </h2>
        <dl className={propios.datos}>
          <div>
            <dt>DNI</dt>
            <dd className="numero">{s.dni}</dd>
          </div>
          <div>
            <dt>Teléfono</dt>
            <dd>
              <a href={`tel:${s.telefono}`}>{s.telefono}</a>
            </dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>
              <a href={`mailto:${s.email}`}>{s.email}</a>
            </dd>
          </div>
          <div>
            <dt>Plan</dt>
            <dd>{s.plan.nombre}</dd>
          </div>
          <div>
            <dt>Descuento</dt>
            <dd>{s.descuento?.nombre ?? 'Sin descuento'}</dd>
          </div>
          <div>
            <dt>Contacto de emergencia</dt>
            <dd>
              {s.emergenciaNombre},{' '}
              <a href={`tel:${s.emergenciaTelefono}`}>{s.emergenciaTelefono}</a>
            </dd>
          </div>
          <div>
            <dt>Cuenta en la app</dt>
            <dd className={propios.enlinea}>
              {s.cuentaActivada ? (
                'Activada'
              ) : (
                <>
                  Sin activar
                  {puedeEditar && s.activo && (
                    <button
                      type="button"
                      className={`boton boton-secundario ${propios.botonChico}`}
                      onClick={() => reenviar.mutate()}
                      disabled={reenviar.isPending}
                    >
                      {reenviar.isPending ? 'Enviando…' : 'Reenviar mail'}
                    </button>
                  )}
                </>
              )}
            </dd>
          </div>
          <div>
            <dt>Socio desde</dt>
            <dd className="numero">{formatearFecha(s.creadoEn)}</dd>
          </div>
        </dl>
      </section>

      {puedeEditar && (
        <section className={estilos.seccion} aria-labelledby="titulo-pagos">
          <h2 id="titulo-pagos" className={estilos.tituloSeccion}>
            Pagos
          </h2>
          {pagos.isPending && <p className="texto-suave">Cargando…</p>}
          {pagos.isError && <p className="alerta-error">{pagos.error.message}</p>}
          {pagos.data?.length === 0 && (
            <p className="texto-suave">Todavía no tiene pagos registrados.</p>
          )}
          {pagos.data && pagos.data.length > 0 && (
            <div className={tabla.contenedor}>
              <table className={tabla.tabla}>
                <thead>
                  <tr>
                    <th scope="col">Período</th>
                    <th scope="col" className={tabla.numero}>
                      Monto
                    </th>
                    <th scope="col" className={tabla.secundaria}>
                      Forma
                    </th>
                    <th scope="col" className={tabla.secundaria}>
                      Registrado
                    </th>
                    {esDueno && (
                      <th scope="col">
                        <span className="solo-lector">Acciones</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {pagos.data.map((pago) => (
                    <tr key={pago.id} className={pago.anulacion ? propios.anulado : undefined}>
                      <td>
                        <span className={propios.capitalizar}>
                          {formatearPeriodo(pago.periodoDesde, pago.periodoHasta)}
                        </span>
                        {pago.anulacion && (
                          <span className={propios.motivo}>
                            Anulado por {pago.anulacion.por.nombre}: {pago.anulacion.motivo}
                          </span>
                        )}
                      </td>
                      <td className={`numero ${tabla.numero}`}>
                        <span className={propios.monto}>{formatearPesos(pago.montoFinal)}</span>
                      </td>
                      <td className={tabla.secundaria}>{NOMBRES_FORMA_PAGO[pago.formaPago]}</td>
                      <td className={`${tabla.secundaria} texto-suave`}>
                        {formatearFechaHora(pago.creadoEn)}, {pago.registradoPor.nombre}
                      </td>
                      {esDueno && (
                        <td className={tabla.numero}>
                          {!pago.anulacion && (
                            <button
                              type="button"
                              className={`boton boton-fantasma ${propios.botonChico}`}
                              onClick={() => setPagoAAnular(pago)}
                            >
                              Anular
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {armaRutinas && s.activo && <RutinasDelSocio socioId={s.id} />}

      {puedeEditar && (
        <section className={`${estilos.seccion} ${propios.zonaBaja}`}>
          <div>
            <h2 className={estilos.tituloSeccion}>{s.activo ? 'Dar de baja' : 'Reactivar'}</h2>
            <p className="texto-suave">
              {s.activo
                ? 'Deja de aparecer en el listado y no puede entrar a la app. Sus datos y pagos se conservan.'
                : 'Vuelve a aparecer en el listado y puede volver a entrar a la app.'}
            </p>
          </div>
          {s.activo ? (
            <button
              type="button"
              className="boton boton-peligro"
              onClick={() => setConfirmandoBaja(true)}
            >
              Dar de baja
            </button>
          ) : (
            <button
              type="button"
              className="boton boton-secundario"
              onClick={() => cambiarActivo.mutate(true)}
              disabled={cambiarActivo.isPending}
            >
              Reactivar
            </button>
          )}
        </section>
      )}

      <DialogoCobro
        socio={s}
        abierto={cobrando}
        alCerrar={() => setCobrando(false)}
        alCobrar={() => setAviso('cobrado')}
      />

      <DialogoAnular
        pago={pagoAAnular}
        alCerrar={() => setPagoAAnular(null)}
        alAnular={() => setAviso('anulado')}
      />

      <Dialogo
        abierto={confirmandoBaja}
        alCerrar={() => setConfirmandoBaja(false)}
        titulo={`¿Dar de baja a ${s.nombre} ${s.apellido}?`}
      >
        <p>
          Su cuota figura como <strong>{NOMBRES_ESTADO_CUOTA[s.cuota.estado].toLowerCase()}</strong>
          . Sus datos y pagos se conservan, y se puede reactivar cuando quieras.
        </p>
        {cambiarActivo.isError && <p className="alerta-error">{cambiarActivo.error.message}</p>}
        <div className={estilos.botonera}>
          <button
            type="button"
            className="boton boton-peligro-lleno"
            onClick={() => cambiarActivo.mutate(false)}
            disabled={cambiarActivo.isPending}
          >
            {cambiarActivo.isPending ? 'Dando de baja…' : 'Dar de baja'}
          </button>
          <button
            type="button"
            className="boton boton-secundario"
            onClick={() => setConfirmandoBaja(false)}
          >
            Cancelar
          </button>
        </div>
      </Dialogo>
    </div>
  );
}

/** Anular un pago: solo el dueño, y siempre con un motivo que queda registrado. */
function DialogoAnular({
  pago,
  alCerrar,
  alAnular,
}: {
  pago: Pago | null;
  alCerrar: () => void;
  alAnular: () => void;
}) {
  const clienteQuery = useQueryClient();
  const [motivo, setMotivo] = useState('');

  const anular = useMutation({
    mutationFn: (datos: { id: string; motivo: string }) =>
      pedir<Pago>(`/pagos/${datos.id}/anular`, {
        metodo: 'POST',
        cuerpo: { motivo: datos.motivo },
      }),
    onSuccess: async () => {
      await clienteQuery.invalidateQueries({ queryKey: ['socios'] });
      cerrar();
      alAnular();
    },
  });

  const cerrar = () => {
    setMotivo('');
    anular.reset();
    alCerrar();
  };

  return (
    <Dialogo abierto={pago !== null} alCerrar={cerrar} titulo="Anular pago">
      {pago && (
        <form
          className={estilos.formularioDialogo}
          onSubmit={(evento) => {
            evento.preventDefault();
            anular.mutate({ id: pago.id, motivo });
          }}
        >
          <p>
            Pago de <strong>{formatearPesos(pago.montoFinal)}</strong> por{' '}
            {formatearPeriodo(pago.periodoDesde, pago.periodoHasta)}. El pago no se borra: queda en
            el historial como anulado, y esos meses vuelven a figurar como impagos.
          </p>
          <div className="campo">
            <label htmlFor="motivo-anulacion">Motivo</label>
            <textarea
              id="motivo-anulacion"
              rows={3}
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              placeholder="Ej.: se cargó al socio equivocado"
              required
            />
          </div>
          {anular.isError && <p className="alerta-error">{mensajeDeError(anular.error)}</p>}
          <div className={estilos.botonera}>
            <button
              type="submit"
              className="boton boton-peligro-lleno"
              disabled={anular.isPending || motivo.trim().length === 0}
            >
              {anular.isPending ? 'Anulando…' : 'Anular pago'}
            </button>
            <button type="button" className="boton boton-secundario" onClick={cerrar}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </Dialogo>
  );
}
