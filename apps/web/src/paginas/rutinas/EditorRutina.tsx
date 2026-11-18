import { useState } from 'react';
import {
  useFieldArray,
  useForm,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { esquemaGuardarRutina, type DatosGuardarRutina } from '@gimnasio/compartido';
import { mostrarErrorEnFormulario } from '../../api/formularios';
import { Campo } from '../../componentes/Campo';
import estilos from './rutinas.module.css';

/** Lo que maneja el formulario ANTES de validar (las series llegan como texto del input). */
type ValoresFormulario = z.input<typeof esquemaGuardarRutina>;

const EJERCICIO_VACIO = { nombre: '', series: 3, repeticiones: '', descanso: '', notas: '' };
const diaVacio = (numero: number) => ({ nombre: `Día ${numero}`, ejercicios: [EJERCICIO_VACIO] });

interface Props {
  inicial?: DatosGuardarRutina;
  textoBoton: string;
  alGuardar: (datos: DatosGuardarRutina) => Promise<void>;
}

/**
 * Formulario de una rutina: nombre, descripción y DÍAS, cada uno con sus EJERCICIOS.
 * Es una lista dentro de otra: `useFieldArray` maneja la lista de días, y cada día
 * (componente `EditorDia`) tiene su propio `useFieldArray` para sus ejercicios.
 */
export function EditorRutina({ inicial, textoBoton, alGuardar }: Props) {
  const [errorGeneral, setErrorGeneral] = useState<string>();
  const formulario = useForm<ValoresFormulario, unknown, DatosGuardarRutina>({
    resolver: zodResolver(esquemaGuardarRutina),
    defaultValues: inicial ?? { nombre: '', descripcion: '', dias: [diaVacio(1)] },
  });
  const { control, register } = formulario;
  const { errors: errores, isSubmitting: enviando } = formulario.formState;
  const dias = useFieldArray({ control, name: 'dias' });

  const enviar = formulario.handleSubmit(async (datos) => {
    setErrorGeneral(undefined);
    try {
      await alGuardar(datos);
    } catch (error) {
      setErrorGeneral(mostrarErrorEnFormulario(error, formulario.setError));
    }
  });

  return (
    <form className={estilos.editor} onSubmit={enviar} noValidate>
      {errorGeneral && (
        <p className="alerta-error" role="alert">
          {errorGeneral}
        </p>
      )}
      <div className={estilos.cabecera}>
        <Campo
          etiqueta="Nombre de la rutina"
          placeholder="Ej. Fuerza principiante"
          error={errores.nombre?.message}
          {...register('nombre')}
        />
        <Campo
          etiqueta="Descripción (opcional)"
          placeholder="Ej. 3 días, cuerpo completo"
          error={errores.descripcion?.message}
          {...register('descripcion')}
        />
      </div>

      {dias.fields.map((dia, indice) => (
        // `dia.id` lo genera useFieldArray: una key estable aunque se borren o muevan días.
        <fieldset key={dia.id} className={estilos.dia}>
          <div className={estilos.encabezadoDia}>
            <legend className="solo-lector">Día {indice + 1}</legend>
            <Campo
              etiqueta={`Día ${indice + 1}`}
              placeholder="Ej. Piernas"
              error={errores.dias?.[indice]?.nombre?.message}
              {...register(`dias.${indice}.nombre`)}
            />
            <button
              type="button"
              className="boton boton-fantasma boton-icono"
              onClick={() => dias.remove(indice)}
              disabled={dias.fields.length === 1}
              title="Quitar este día"
              aria-label={`Quitar el día ${indice + 1}`}
            >
              <Trash2 size={18} aria-hidden />
            </button>
          </div>
          <EditorDia indice={indice} control={control} register={register} errores={errores} />
        </fieldset>
      ))}
      {errores.dias?.root && <p className="campo-error">{errores.dias.root.message}</p>}

      <div className={estilos.botonera}>
        {dias.fields.length < 7 && (
          <button
            type="button"
            className="boton boton-secundario"
            onClick={() => dias.append(diaVacio(dias.fields.length + 1))}
          >
            <Plus size={18} aria-hidden /> Agregar día
          </button>
        )}
        <button type="submit" className="boton boton-principal" disabled={enviando}>
          {enviando ? 'Guardando…' : textoBoton}
        </button>
      </div>
    </form>
  );
}

interface PropsDia {
  indice: number;
  control: Control<ValoresFormulario, unknown, DatosGuardarRutina>;
  register: UseFormRegister<ValoresFormulario>;
  errores: FieldErrors<ValoresFormulario>;
}

/** Los ejercicios de UN día. */
function EditorDia({ indice, control, register, errores }: PropsDia) {
  const ejercicios = useFieldArray({ control, name: `dias.${indice}.ejercicios` });
  const erroresDia = errores.dias?.[indice]?.ejercicios;

  return (
    <>
      <ol className={estilos.ejercicios}>
        {ejercicios.fields.map((ejercicio, j) => {
          const nombre = `dias.${indice}.ejercicios.${j}` as const;
          const error = erroresDia?.[j];
          return (
            <li key={ejercicio.id} className={estilos.ejercicio}>
              <Campo
                etiqueta="Ejercicio"
                placeholder="Sentadilla"
                error={error?.nombre?.message}
                {...register(`${nombre}.nombre`)}
              />
              <Campo
                etiqueta="Series"
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                error={error?.series?.message}
                {...register(`${nombre}.series`)}
              />
              <Campo
                etiqueta="Reps"
                placeholder="8-12"
                error={error?.repeticiones?.message}
                {...register(`${nombre}.repeticiones`)}
              />
              <Campo
                etiqueta="Descanso"
                placeholder="90 seg"
                error={error?.descanso?.message}
                {...register(`${nombre}.descanso`)}
              />
              <Campo
                etiqueta="Notas"
                placeholder="Opcional"
                className={estilos.notas}
                error={error?.notas?.message}
                {...register(`${nombre}.notas`)}
              />
              <div className={estilos.accionesEjercicio}>
                <button
                  type="button"
                  className="boton boton-fantasma boton-icono"
                  onClick={() => ejercicios.move(j, j - 1)}
                  disabled={j === 0}
                  aria-label="Subir ejercicio"
                  title="Subir"
                >
                  <ArrowUp size={16} aria-hidden />
                </button>
                <button
                  type="button"
                  className="boton boton-fantasma boton-icono"
                  onClick={() => ejercicios.move(j, j + 1)}
                  disabled={j === ejercicios.fields.length - 1}
                  aria-label="Bajar ejercicio"
                  title="Bajar"
                >
                  <ArrowDown size={16} aria-hidden />
                </button>
                <button
                  type="button"
                  className="boton boton-fantasma boton-icono"
                  onClick={() => ejercicios.remove(j)}
                  disabled={ejercicios.fields.length === 1}
                  aria-label="Quitar ejercicio"
                  title="Quitar"
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      {erroresDia?.root && <p className="campo-error">{erroresDia.root.message}</p>}
      {ejercicios.fields.length < 30 && (
        <button
          type="button"
          className={`boton boton-fantasma ${estilos.agregarEjercicio}`}
          onClick={() => ejercicios.append(EJERCICIO_VACIO)}
        >
          <Plus size={16} aria-hidden /> Agregar ejercicio
        </button>
      )}
    </>
  );
}
