import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  esquemaConfiguracionGimnasio,
  type ConfiguracionGimnasio,
  type DatosConfiguracionGimnasio,
} from '@gimnasio/compartido';
import { pedir, refrescarSesion } from '../../api/cliente';
import { mostrarErrorEnFormulario } from '../../api/formularios';
import { Campo } from '../../componentes/Campo';
import { contraste, textoSobre } from '../../tema/marca';
import estilos from '../paginas.module.css';
import propios from './Configuracion.module.css';

export function Configuracion() {
  const configuracion = useQuery({
    queryKey: ['mi-gimnasio'],
    queryFn: () => pedir<ConfiguracionGimnasio>('/mi-gimnasio'),
  });

  return (
    <div className={estilos.pagina}>
      <header className={estilos.encabezado}>
        <div>
          <h1 className="titulo-pagina">Configuración</h1>
          <p className="texto-suave">La marca del gimnasio y las reglas de la cuota.</p>
        </div>
      </header>
      {configuracion.isPending && <p className="texto-suave">Cargando…</p>}
      {configuracion.isError && <p className="alerta-error">{configuracion.error.message}</p>}
      {configuracion.data && <FormularioConfiguracion configuracion={configuracion.data} />}
    </div>
  );
}

/**
 * Convierten un input vacío en null ("sin logo", "sin capacidad máxima").
 * Reciben unknown porque React Hook Form también les pasa el valor inicial (null o un número),
 * no solo el texto del input.
 */
const vacioANull = (valor: unknown) =>
  typeof valor === 'string' ? (valor.trim() === '' ? null : valor.trim()) : (valor ?? null);
const numeroONull = (valor: unknown) =>
  typeof valor === 'string' ? (valor.trim() === '' ? null : Number(valor)) : (valor ?? null);

function FormularioConfiguracion({ configuracion }: { configuracion: ConfiguracionGimnasio }) {
  const clienteQuery = useQueryClient();
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string }>();

  const formulario = useForm({
    resolver: zodResolver(esquemaConfiguracionGimnasio),
    defaultValues: {
      logoUrl: configuracion.logoUrl,
      colorPrimario: configuracion.colorPrimario,
      colorSecundario: configuracion.colorSecundario,
      diaCierreCobro: configuracion.diaCierreCobro,
      diasAvisoVencimiento: configuracion.diasAvisoVencimiento,
      minutosPermanencia: configuracion.minutosPermanencia,
      capacidadMaxima: configuracion.capacidadMaxima,
    },
  });
  const { errors: errores, isSubmitting: enviando } = formulario.formState;
  const r = formulario.register;

  const [primario = '#000000', secundario = '#000000'] = useWatch({
    control: formulario.control,
    name: ['colorPrimario', 'colorSecundario'],
  });
  const colorValido = (color: string) => /^#[0-9a-fA-F]{6}$/.test(color);
  const coloresValidos = colorValido(primario) && colorValido(secundario);
  const pocoContraste = coloresValidos && contraste(primario, secundario) < 3;

  const enviar = formulario.handleSubmit(async (datos: DatosConfiguracionGimnasio) => {
    setResultado(undefined);
    try {
      const guardada = await pedir<ConfiguracionGimnasio>('/mi-gimnasio', {
        metodo: 'PATCH',
        cuerpo: datos,
      });
      clienteQuery.setQueryData(['mi-gimnasio'], guardada);
      // Las reglas de la cuota cambian el estado de los socios.
      await clienteQuery.invalidateQueries({ queryKey: ['socios'] });
      // La sesión trae los colores del gimnasio: la renovamos para que el panel los use ya.
      await refrescarSesion();
      setResultado({ ok: true, texto: 'Configuración guardada.' });
    } catch (error) {
      setResultado({ ok: false, texto: mostrarErrorEnFormulario(error, formulario.setError) });
    }
  });

  return (
    <form className={estilos.formulario} onSubmit={enviar} noValidate>
      {resultado && (
        <p className={resultado.ok ? 'alerta-ok' : 'alerta-error'} role="status">
          {resultado.texto}
        </p>
      )}

      <fieldset className={estilos.grupo}>
        <legend>Marca</legend>
        <div className={estilos.ancho}>
          <Campo
            etiqueta="Logo (link a la imagen)"
            type="url"
            placeholder="https://…"
            ayuda="Una URL https pública de la imagen. Si lo dejás vacío, se muestra el nombre."
            error={errores.logoUrl?.message}
            {...r('logoUrl', { setValueAs: vacioANull })}
          />
        </div>
        <SelectorColor
          etiqueta="Color principal"
          ayuda="Botones y destacados"
          valor={primario}
          error={errores.colorPrimario?.message}
          alCambiar={(color) => formulario.setValue('colorPrimario', color, { shouldDirty: true })}
        />
        <SelectorColor
          etiqueta="Color de fondo"
          ayuda="Menú lateral y pantalla de ingreso"
          valor={secundario}
          error={errores.colorSecundario?.message}
          alCambiar={(color) =>
            formulario.setValue('colorSecundario', color, { shouldDirty: true })
          }
        />
        {coloresValidos && (
          <div
            className={`${estilos.ancho} ${propios.muestra}`}
            style={{ background: secundario, color: textoSobre(secundario) }}
            aria-hidden="true"
          >
            <span className="titular" style={{ color: pocoContraste ? undefined : primario }}>
              {configuracion.nombre}
            </span>
            <span
              className={propios.botonMuestra}
              style={{ background: primario, color: textoSobre(primario) }}
            >
              Botón
            </span>
          </div>
        )}
        {pocoContraste && (
          <p className={`alerta-aviso ${estilos.ancho}`}>
            Los dos colores se parecen mucho: el nombre se va a mostrar en{' '}
            {textoSobre(secundario) === '#FFFFFF' ? 'blanco' : 'negro'} para que se lea.
          </p>
        )}
      </fieldset>

      <fieldset className={estilos.grupo}>
        <legend>Cuotas</legend>
        <Campo
          etiqueta="Día de cierre del cobro"
          type="number"
          inputMode="numeric"
          min={1}
          max={28}
          ayuda="Desde el día siguiente, quien no pagó el mes figura como vencido."
          error={errores.diaCierreCobro?.message}
          {...r('diaCierreCobro', { valueAsNumber: true })}
        />
        <Campo
          etiqueta="Días de aviso antes de fin de mes"
          type="number"
          inputMode="numeric"
          min={0}
          max={28}
          ayuda="Cuántos días antes de fin de mes la cuota pasa a “por vencer”."
          error={errores.diasAvisoVencimiento?.message}
          {...r('diasAvisoVencimiento', { valueAsNumber: true })}
        />
      </fieldset>

      <fieldset className={estilos.grupo}>
        <legend>Ocupación</legend>
        <Campo
          etiqueta="Minutos que dura una visita"
          type="number"
          inputMode="numeric"
          min={15}
          max={600}
          ayuda="Para estimar cuánta gente hay: cada ingreso cuenta este tiempo."
          error={errores.minutosPermanencia?.message}
          {...r('minutosPermanencia', { valueAsNumber: true })}
        />
        <Campo
          etiqueta="Capacidad máxima (personas)"
          type="number"
          inputMode="numeric"
          min={1}
          ayuda="Opcional. Para mostrar la ocupación como porcentaje."
          error={errores.capacidadMaxima?.message}
          {...r('capacidadMaxima', { setValueAs: numeroONull })}
        />
      </fieldset>

      <div className={estilos.botonera}>
        <button type="submit" className="boton boton-principal" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar configuración'}
        </button>
      </div>
    </form>
  );
}

/** Selector de color: la paleta del navegador más el código #RRGGBB para pegarlo a mano. */
function SelectorColor({
  etiqueta,
  ayuda,
  valor,
  error,
  alCambiar,
}: {
  etiqueta: string;
  ayuda: string;
  valor: string;
  error: string | undefined;
  alCambiar: (color: string) => void;
}) {
  const id = etiqueta.replace(/\s+/g, '-').toLowerCase();
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      <div className={propios.color}>
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(valor) ? valor : '#000000'}
          onChange={(evento) => alCambiar(evento.target.value.toUpperCase())}
          aria-label={`${etiqueta}: paleta`}
        />
        <input
          id={id}
          value={valor}
          onChange={(evento) => alCambiar(evento.target.value.trim())}
          maxLength={7}
          spellCheck={false}
          aria-invalid={error ? true : undefined}
        />
      </div>
      <small className="texto-suave">{ayuda}</small>
      {error && <span className="campo-error">{error}</span>}
    </div>
  );
}
