import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FORMAS_PAGO,
  NOMBRES_FORMA_PAGO,
  type FormaPago,
  type Pago,
  type Socio,
  type VistaPreviaPago,
} from '@gimnasio/compartido';
import { pedir } from '../../api/cliente';
import { Dialogo } from '../../componentes/Dialogo';
import { Selector } from '../../componentes/Selector';
import { aMes, formatearPeriodo, formatearPesos } from '../../formato';
import estilos from '../paginas.module.css';
import propios from './SocioFicha.module.css';

interface Props {
  socio: Socio;
  abierto: boolean;
  alCerrar: () => void;
  alCobrar: () => void;
}

/**
 * Cobro de una cuota en dos pasos: primero la API dice CUÁNTO y QUÉ MESES (vista previa),
 * y recién al confirmar se registra. El monto nunca lo escribe el usuario: lo calcula la API.
 */
export function DialogoCobro({ socio, abierto, alCerrar, alCobrar }: Props) {
  const clienteQuery = useQueryClient();
  const [formaPago, setFormaPago] = useState<FormaPago>('EFECTIVO');
  // undefined = el mes que sugiere la API (el primero sin pagar).
  const [desde, setDesde] = useState<string>();

  const vistaPrevia = useQuery({
    queryKey: ['socios', 'ficha', socio.id, 'vista-previa', desde ?? 'sugerido'],
    queryFn: () =>
      pedir<VistaPreviaPago>(
        `/socios/${socio.id}/pagos/vista-previa${desde ? `?desde=${desde}` : ''}`,
      ),
    enabled: abierto,
    staleTime: 0,
  });

  const cobrar = useMutation({
    mutationFn: (datos: { formaPago: FormaPago; desde: string }) =>
      pedir<Pago>(`/socios/${socio.id}/pagos`, { metodo: 'POST', cuerpo: datos }),
    onSuccess: async () => {
      await clienteQuery.invalidateQueries({ queryKey: ['socios'] });
      cerrar();
      alCobrar();
    },
  });

  const cerrar = () => {
    setDesde(undefined);
    setFormaPago('EFECTIVO');
    cobrar.reset();
    alCerrar();
  };

  const confirmar = (evento: FormEvent) => {
    evento.preventDefault();
    if (!vistaPrevia.data) return;
    // Mandamos exactamente el mes que se mostró, para que se cobre lo que el usuario vio.
    cobrar.mutate({ formaPago, desde: aMes(vistaPrevia.data.periodoDesde) });
  };

  const datos = vistaPrevia.data;
  const mesElegido = desde ?? (datos ? aMes(datos.periodoDesde) : '');

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={cerrar}
      titulo={`Cobrar a ${socio.nombre} ${socio.apellido}`}
    >
      <form className={estilos.formularioDialogo} onSubmit={confirmar}>
        <div className={estilos.grupo}>
          <div className="campo">
            <label htmlFor="mes-cobro">Desde el mes</label>
            <input
              id="mes-cobro"
              type="month"
              value={mesElegido}
              onChange={(evento) => setDesde(evento.target.value || undefined)}
            />
          </div>
          <Selector
            etiqueta="Forma de pago"
            value={formaPago}
            onChange={(evento) => setFormaPago(evento.target.value as FormaPago)}
          >
            {FORMAS_PAGO.map((forma) => (
              <option key={forma} value={forma}>
                {NOMBRES_FORMA_PAGO[forma]}
              </option>
            ))}
          </Selector>
        </div>

        {vistaPrevia.isPending && <p className="texto-suave">Calculando…</p>}
        {vistaPrevia.isError && <p className="alerta-error">{vistaPrevia.error.message}</p>}
        {datos && (
          <dl className={propios.ticket}>
            <div>
              <dt>Plan</dt>
              <dd>{datos.plan.nombre}</dd>
            </div>
            <div>
              <dt>Período</dt>
              <dd className={propios.capitalizar}>
                {formatearPeriodo(datos.periodoDesde, datos.periodoHasta)}
              </dd>
            </div>
            <div>
              <dt>Precio</dt>
              <dd className="numero">{formatearPesos(datos.montoBase)}</dd>
            </div>
            {datos.montoDescuento > 0 && (
              <div>
                <dt>Descuento {datos.descuentoNombre}</dt>
                <dd className="numero">-{formatearPesos(datos.montoDescuento)}</dd>
              </div>
            )}
            <div className={propios.total}>
              <dt>Total</dt>
              <dd className="titular numero">{formatearPesos(datos.montoFinal)}</dd>
            </div>
          </dl>
        )}

        {cobrar.isError && (
          <p className="alerta-error" role="alert">
            {cobrar.error.message}
          </p>
        )}

        <div className={estilos.botonera}>
          <button
            type="submit"
            className="boton boton-principal"
            disabled={!datos || cobrar.isPending}
          >
            {cobrar.isPending
              ? 'Registrando…'
              : datos
                ? `Registrar pago de ${formatearPesos(datos.montoFinal)}`
                : 'Registrar pago'}
          </button>
          <button type="button" className="boton boton-secundario" onClick={cerrar}>
            Cancelar
          </button>
        </div>
      </form>
    </Dialogo>
  );
}
