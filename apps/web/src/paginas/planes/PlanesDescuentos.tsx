import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import {
  esquemaCrearDescuento,
  esquemaCrearPlan,
  TIPOS_DESCUENTO,
  type DatosCrearDescuento,
  type DatosCrearPlan,
  type Descuento,
  type Plan,
} from '@gimnasio/compartido';
import { pedir } from '../../api/cliente';
import { mostrarErrorEnFormulario } from '../../api/formularios';
import { Campo } from '../../componentes/Campo';
import { Dialogo } from '../../componentes/Dialogo';
import { Selector } from '../../componentes/Selector';
import { formatearPesos, textoDescuento } from '../../formato';
import estilos from '../paginas.module.css';
import tabla from '../tabla.module.css';

/**
 * Planes y descuentos del gimnasio (solo el dueño los modifica).
 * No se borran: tienen socios y pagos asociados. Se desactivan, y un plan desactivado
 * ya no se ofrece al dar de alta, pero los socios que lo tienen lo conservan.
 */
export function PlanesDescuentos() {
  const planes = useQuery({ queryKey: ['planes'], queryFn: () => pedir<Plan[]>('/planes') });
  const descuentos = useQuery({
    queryKey: ['descuentos'],
    queryFn: () => pedir<Descuento[]>('/descuentos'),
  });
  // undefined = cerrado; null = nuevo; un objeto = editar ese.
  const [plan, setPlan] = useState<Plan | null>();
  const [descuento, setDescuento] = useState<Descuento | null>();

  return (
    <div className={estilos.pagina}>
      <header className={estilos.encabezado}>
        <div>
          <h1 className="titulo-pagina">Planes y descuentos</h1>
          <p className="texto-suave">
            Lo que se cobra cada mes. Cambiar un precio afecta a los pagos que se registren desde
            ahora; los anteriores conservan el monto que se cobró.
          </p>
        </div>
      </header>

      <section className={estilos.seccion} aria-labelledby="titulo-planes">
        <div className={estilos.encabezadoSeccion}>
          <h2 id="titulo-planes" className={estilos.tituloSeccion}>
            Planes
          </h2>
          <button type="button" className="boton boton-secundario" onClick={() => setPlan(null)}>
            <Plus size={18} aria-hidden /> Nuevo plan
          </button>
        </div>
        {planes.isError && <p className="alerta-error">{planes.error.message}</p>}
        {planes.data?.length === 0 && (
          <p className="texto-suave">
            Todavía no hay planes. Creá el primero para poder dar de alta socios.
          </p>
        )}
        {planes.data && planes.data.length > 0 && (
          <div className={tabla.contenedor}>
            <table className={tabla.tabla}>
              <thead>
                <tr>
                  <th scope="col">Plan</th>
                  <th scope="col" className={tabla.numero}>
                    Precio
                  </th>
                  <th scope="col" className={tabla.secundaria}>
                    Cubre
                  </th>
                  <th scope="col" className={`${tabla.numero} ${tabla.secundaria}`}>
                    Socios
                  </th>
                  <th scope="col">
                    <span className="solo-lector">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {planes.data.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.nombre}</strong>{' '}
                      {!item.activo && <span className="etiqueta">Inactivo</span>}
                    </td>
                    <td className={`numero ${tabla.numero}`}>{formatearPesos(item.precio)}</td>
                    <td className={tabla.secundaria}>
                      {item.duracionMeses} {item.duracionMeses === 1 ? 'mes' : 'meses'}
                    </td>
                    <td className={`numero ${tabla.numero} ${tabla.secundaria}`}>
                      {item.cantidadSocios}
                    </td>
                    <td className={tabla.numero}>
                      <button
                        type="button"
                        className="boton boton-fantasma"
                        onClick={() => setPlan(item)}
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={estilos.seccion} aria-labelledby="titulo-descuentos">
        <div className={estilos.encabezadoSeccion}>
          <h2 id="titulo-descuentos" className={estilos.tituloSeccion}>
            Descuentos
          </h2>
          <button
            type="button"
            className="boton boton-secundario"
            onClick={() => setDescuento(null)}
          >
            <Plus size={18} aria-hidden /> Nuevo descuento
          </button>
        </div>
        {descuentos.isError && <p className="alerta-error">{descuentos.error.message}</p>}
        {descuentos.data?.length === 0 && (
          <p className="texto-suave">
            Sin descuentos. Son opcionales: por ejemplo, para estudiantes o familias.
          </p>
        )}
        {descuentos.data && descuentos.data.length > 0 && (
          <div className={tabla.contenedor}>
            <table className={tabla.tabla}>
              <thead>
                <tr>
                  <th scope="col">Descuento</th>
                  <th scope="col" className={tabla.numero}>
                    Valor
                  </th>
                  <th scope="col" className={`${tabla.numero} ${tabla.secundaria}`}>
                    Socios
                  </th>
                  <th scope="col">
                    <span className="solo-lector">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {descuentos.data.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.nombre}</strong>{' '}
                      {!item.activo && <span className="etiqueta">Inactivo</span>}
                    </td>
                    <td className={`numero ${tabla.numero}`}>{textoDescuento(item)}</td>
                    <td className={`numero ${tabla.numero} ${tabla.secundaria}`}>
                      {item.cantidadSocios}
                    </td>
                    <td className={tabla.numero}>
                      <button
                        type="button"
                        className="boton boton-fantasma"
                        onClick={() => setDescuento(item)}
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialogo
        abierto={plan !== undefined}
        alCerrar={() => setPlan(undefined)}
        titulo={plan ? `Editar plan ${plan.nombre}` : 'Nuevo plan'}
      >
        <FormularioPlan
          key={plan?.id ?? 'nuevo'}
          plan={plan ?? null}
          alTerminar={() => setPlan(undefined)}
        />
      </Dialogo>

      <Dialogo
        abierto={descuento !== undefined}
        alCerrar={() => setDescuento(undefined)}
        titulo={descuento ? `Editar descuento ${descuento.nombre}` : 'Nuevo descuento'}
      >
        <FormularioDescuento
          key={descuento?.id ?? 'nuevo'}
          descuento={descuento ?? null}
          alTerminar={() => setDescuento(undefined)}
        />
      </Dialogo>
    </div>
  );
}

/** Casilla "Activo" para planes y descuentos. */
function CasillaActivo({
  activo,
  setActivo,
  ayuda,
}: {
  activo: boolean;
  setActivo: (activo: boolean) => void;
  ayuda: string;
}) {
  return (
    <label className="casilla">
      <input
        type="checkbox"
        checked={activo}
        onChange={(evento) => setActivo(evento.target.checked)}
      />
      <span>
        Activo
        <small className="texto-suave">{ayuda}</small>
      </span>
    </label>
  );
}

function FormularioPlan({ plan, alTerminar }: { plan: Plan | null; alTerminar: () => void }) {
  const clienteQuery = useQueryClient();
  const [activo, setActivo] = useState(plan?.activo ?? true);
  const [errorGeneral, setErrorGeneral] = useState<string>();
  // El tipo explícito evita que TypeScript deduzca uno distinto para el alta y la edición.
  const formulario = useForm<DatosCrearPlan>({
    resolver: zodResolver(esquemaCrearPlan),
    defaultValues: plan
      ? { nombre: plan.nombre, precio: plan.precio, duracionMeses: plan.duracionMeses }
      : { duracionMeses: 1 },
  });
  const { errors: errores, isSubmitting: enviando } = formulario.formState;

  const guardar = useMutation({
    mutationFn: (datos: DatosCrearPlan) =>
      plan
        ? pedir<Plan>(`/planes/${plan.id}`, { metodo: 'PATCH', cuerpo: { ...datos, activo } })
        : pedir<Plan>('/planes', { metodo: 'POST', cuerpo: datos }),
    onSuccess: () => clienteQuery.invalidateQueries({ queryKey: ['planes'] }),
  });

  const enviar = formulario.handleSubmit(async (datos) => {
    try {
      await guardar.mutateAsync(datos);
      alTerminar();
    } catch (error) {
      setErrorGeneral(mostrarErrorEnFormulario(error, formulario.setError));
    }
  });

  return (
    <form className={estilos.formularioDialogo} onSubmit={enviar} noValidate>
      {errorGeneral && <p className="alerta-error">{errorGeneral}</p>}
      <Campo
        etiqueta="Nombre"
        placeholder="Ej.: Mensual"
        error={errores.nombre?.message}
        {...formulario.register('nombre')}
      />
      <div className={estilos.grupo}>
        <Campo
          etiqueta="Precio ($)"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          error={errores.precio?.message}
          {...formulario.register('precio', { valueAsNumber: true })}
        />
        <Campo
          etiqueta="Meses que cubre"
          type="number"
          inputMode="numeric"
          min={1}
          max={24}
          ayuda="1 = mensual, 3 = trimestral"
          error={errores.duracionMeses?.message}
          {...formulario.register('duracionMeses', { valueAsNumber: true })}
        />
      </div>
      {plan && (
        <CasillaActivo
          activo={activo}
          setActivo={setActivo}
          ayuda="Si lo desactivás, no se ofrece a socios nuevos. Los que ya lo tienen lo conservan."
        />
      )}
      <div className={estilos.botonera}>
        <button type="submit" className="boton boton-principal" disabled={enviando}>
          {enviando ? 'Guardando…' : plan ? 'Guardar cambios' : 'Crear plan'}
        </button>
        <button type="button" className="boton boton-secundario" onClick={alTerminar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function FormularioDescuento({
  descuento,
  alTerminar,
}: {
  descuento: Descuento | null;
  alTerminar: () => void;
}) {
  const clienteQuery = useQueryClient();
  const [activo, setActivo] = useState(descuento?.activo ?? true);
  const [errorGeneral, setErrorGeneral] = useState<string>();
  const formulario = useForm<DatosCrearDescuento>({
    resolver: zodResolver(esquemaCrearDescuento),
    defaultValues: descuento
      ? { nombre: descuento.nombre, tipo: descuento.tipo, valor: descuento.valor }
      : { tipo: 'PORCENTAJE' },
  });
  const { errors: errores, isSubmitting: enviando } = formulario.formState;
  // useWatch (y no watch): vuelve a dibujar solo cuando cambia el tipo.
  const tipo = useWatch({ control: formulario.control, name: 'tipo' });

  const guardar = useMutation({
    mutationFn: (datos: DatosCrearDescuento) =>
      descuento
        ? pedir<Descuento>(`/descuentos/${descuento.id}`, {
            metodo: 'PATCH',
            cuerpo: { ...datos, activo },
          })
        : pedir<Descuento>('/descuentos', { metodo: 'POST', cuerpo: datos }),
    onSuccess: () => clienteQuery.invalidateQueries({ queryKey: ['descuentos'] }),
  });

  const enviar = formulario.handleSubmit(async (datos) => {
    try {
      await guardar.mutateAsync(datos);
      alTerminar();
    } catch (error) {
      setErrorGeneral(mostrarErrorEnFormulario(error, formulario.setError));
    }
  });

  return (
    <form className={estilos.formularioDialogo} onSubmit={enviar} noValidate>
      {errorGeneral && <p className="alerta-error">{errorGeneral}</p>}
      <Campo
        etiqueta="Nombre"
        placeholder="Ej.: Estudiante"
        error={errores.nombre?.message}
        {...formulario.register('nombre')}
      />
      <div className={estilos.grupo}>
        <Selector etiqueta="Tipo" error={errores.tipo?.message} {...formulario.register('tipo')}>
          {TIPOS_DESCUENTO.map((opcion) => (
            <option key={opcion} value={opcion}>
              {opcion === 'PORCENTAJE' ? 'Porcentaje' : 'Monto fijo'}
            </option>
          ))}
        </Selector>
        <Campo
          etiqueta={tipo === 'PORCENTAJE' ? 'Porcentaje (%)' : 'Monto ($)'}
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          error={errores.valor?.message}
          {...formulario.register('valor', { valueAsNumber: true })}
        />
      </div>
      {descuento && (
        <CasillaActivo
          activo={activo}
          setActivo={setActivo}
          ayuda="Si lo desactivás, no se ofrece a socios nuevos. Los que ya lo tienen lo conservan."
        />
      )}
      <div className={estilos.botonera}>
        <button type="submit" className="boton boton-principal" disabled={enviando}>
          {enviando ? 'Guardando…' : descuento ? 'Guardar cambios' : 'Crear descuento'}
        </button>
        <button type="button" className="boton boton-secundario" onClick={alTerminar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
