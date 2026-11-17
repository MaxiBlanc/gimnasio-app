import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  esquemaCrearSocio,
  type DatosCrearSocio,
  type Descuento,
  type Plan,
  type RespuestaAltaSocio,
  type Socio,
} from '@gimnasio/compartido';
import { pedir } from '../../api/cliente';
import { mostrarErrorEnFormulario } from '../../api/formularios';
import { Campo } from '../../componentes/Campo';
import { Selector } from '../../componentes/Selector';
import { formatearPesos, textoDescuento } from '../../formato';
import estilos from '../paginas.module.css';

interface Props {
  /** Si viene, es una edición; si no, un alta. */
  socio?: Socio;
}

/** Alta y edición de socio: es el mismo formulario, cambia a dónde se manda. */
export function FormularioSocio({ socio }: Props) {
  const navegar = useNavigate();
  const clienteQuery = useQueryClient();
  const [errorGeneral, setErrorGeneral] = useState<string>();

  const planes = useQuery({ queryKey: ['planes'], queryFn: () => pedir<Plan[]>('/planes') });
  const descuentos = useQuery({
    queryKey: ['descuentos'],
    queryFn: () => pedir<Descuento[]>('/descuentos'),
  });

  // Se ofrecen los activos, más el que ya tiene el socio aunque se haya desactivado
  // (si no, al editar otro dato el select quedaría vacío).
  const planesVisibles = planes.data?.filter((plan) => plan.activo || plan.id === socio?.plan.id);
  const descuentosVisibles = descuentos.data?.filter(
    (descuento) => descuento.activo || descuento.id === socio?.descuento?.id,
  );

  const formulario = useForm({
    resolver: zodResolver(esquemaCrearSocio),
    defaultValues: socio
      ? {
          nombre: socio.nombre,
          apellido: socio.apellido,
          dni: socio.dni,
          telefono: socio.telefono,
          email: socio.email,
          emergenciaNombre: socio.emergenciaNombre,
          emergenciaTelefono: socio.emergenciaTelefono,
          planId: socio.plan.id,
          descuentoId: socio.descuento?.id ?? null,
        }
      : { descuentoId: null },
  });
  const { errors: errores, isSubmitting: enviando } = formulario.formState;

  const guardar = useMutation({
    mutationFn: async (datos: DatosCrearSocio) => {
      if (socio) {
        const editado = await pedir<Socio>(`/socios/${socio.id}`, {
          metodo: 'PATCH',
          cuerpo: datos,
        });
        return { socio: editado, correoEnviado: null };
      }
      return pedir<RespuestaAltaSocio>('/socios', { metodo: 'POST', cuerpo: datos });
    },
    onSuccess: async ({ socio: guardado, correoEnviado }) => {
      // Todo lo cacheado de socios (listado, resumen, ficha) puede haber cambiado.
      await clienteQuery.invalidateQueries({ queryKey: ['socios'] });
      void navegar(`/panel/socios/${guardado.id}`, {
        replace: true,
        state: { aviso: socio ? 'editado' : correoEnviado ? 'alta' : 'alta-sin-correo' },
      });
    },
  });

  const enviar = formulario.handleSubmit(async (datos) => {
    setErrorGeneral(undefined);
    try {
      await guardar.mutateAsync(datos);
    } catch (error) {
      setErrorGeneral(mostrarErrorEnFormulario(error, formulario.setError));
    }
  });

  const r = formulario.register;

  // El formulario se dibuja recién con los planes y descuentos cargados: si los <select>
  // aparecieran sin opciones, no podrían mostrar el plan que ya tiene el socio.
  if (planes.isError || descuentos.isError) {
    return <p className="alerta-error">{(planes.error ?? descuentos.error)?.message}</p>;
  }
  if (!planesVisibles || !descuentosVisibles) return <p className="texto-suave">Cargando…</p>;

  return (
    <form className={estilos.formulario} onSubmit={enviar} noValidate>
      {errorGeneral && (
        <p className="alerta-error" role="alert">
          {errorGeneral}
        </p>
      )}

      <fieldset className={estilos.grupo}>
        <legend>Datos personales</legend>
        <Campo
          etiqueta="Nombre"
          autoComplete="off"
          error={errores.nombre?.message}
          {...r('nombre')}
        />
        <Campo
          etiqueta="Apellido"
          autoComplete="off"
          error={errores.apellido?.message}
          {...r('apellido')}
        />
        <Campo
          etiqueta="DNI"
          inputMode="numeric"
          ayuda="Con o sin puntos"
          error={errores.dni?.message}
          {...r('dni')}
        />
        <Campo
          etiqueta="Teléfono"
          type="tel"
          error={errores.telefono?.message}
          {...r('telefono')}
        />
        <div className={estilos.ancho}>
          <Campo
            etiqueta="Email"
            type="email"
            ayuda={
              socio
                ? undefined
                : 'Le llega un mail para crear su contraseña y entrar a la app desde el celular.'
            }
            error={errores.email?.message}
            {...r('email')}
          />
        </div>
      </fieldset>

      <fieldset className={estilos.grupo}>
        <legend>Contacto de emergencia</legend>
        <Campo
          etiqueta="Nombre"
          error={errores.emergenciaNombre?.message}
          {...r('emergenciaNombre')}
        />
        <Campo
          etiqueta="Teléfono"
          type="tel"
          error={errores.emergenciaTelefono?.message}
          {...r('emergenciaTelefono')}
        />
      </fieldset>

      <fieldset className={estilos.grupo}>
        <legend>Plan</legend>
        <Selector etiqueta="Plan" error={errores.planId?.message} {...r('planId')}>
          <option value="">Elegí un plan</option>
          {planesVisibles.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.nombre} ({formatearPesos(plan.precio)})
            </option>
          ))}
        </Selector>
        <Selector
          etiqueta="Descuento"
          error={errores.descuentoId?.message}
          {...r('descuentoId', { setValueAs: (valor: string | null) => valor || null })}
        >
          <option value="">Sin descuento</option>
          {descuentosVisibles.map((descuento) => (
            <option key={descuento.id} value={descuento.id}>
              {descuento.nombre} ({textoDescuento(descuento)})
            </option>
          ))}
        </Selector>
        {planes.data?.length === 0 && (
          <p className={`alerta-aviso ${estilos.ancho}`}>
            Todavía no hay planes cargados. El dueño los crea en “Planes y descuentos”.
          </p>
        )}
      </fieldset>

      <div className={estilos.botonera}>
        <button type="submit" className="boton boton-principal" disabled={enviando}>
          {enviando ? 'Guardando…' : socio ? 'Guardar cambios' : 'Dar de alta'}
        </button>
        <Link
          to={socio ? `/panel/socios/${socio.id}` : '/panel/socios'}
          className="boton boton-secundario"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
