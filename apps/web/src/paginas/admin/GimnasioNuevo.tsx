import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import {
  esquemaCrearGimnasio,
  normalizarTexto,
  type GimnasioAdminDetalle,
} from '@gimnasio/compartido';
import { pedir } from '../../api/cliente';
import { mostrarErrorEnFormulario } from '../../api/formularios';
import { Campo } from '../../componentes/Campo';
import estilos from '../paginas.module.css';

/** "Power Gym Centro" → "power-gym-centro": sugerencia de código a partir del nombre. */
function sugerirCodigo(nombre: string): string {
  return normalizarTexto(nombre)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function GimnasioNuevo() {
  const navegar = useNavigate();
  const clienteQuery = useQueryClient();
  const [errorGeneral, setErrorGeneral] = useState<string>();
  // Mientras el admin no toque el código a mano, lo vamos sugiriendo desde el nombre.
  const [codigoEditado, setCodigoEditado] = useState(false);

  const formulario = useForm({ resolver: zodResolver(esquemaCrearGimnasio) });
  const { errors: errores, isSubmitting: enviando } = formulario.formState;
  const r = formulario.register;

  const enviar = formulario.handleSubmit(async (datos) => {
    setErrorGeneral(undefined);
    try {
      const creado = await pedir<GimnasioAdminDetalle>('/admin/gimnasios', {
        metodo: 'POST',
        cuerpo: datos,
      });
      await clienteQuery.invalidateQueries({ queryKey: ['admin'] });
      void navegar(`/admin/gimnasios/${creado.id}`, { replace: true, state: { aviso: 'alta' } });
    } catch (error) {
      setErrorGeneral(mostrarErrorEnFormulario(error, formulario.setError));
    }
  });

  return (
    <div className={estilos.pagina}>
      <header>
        <Link to="/admin" className={estilos.volver}>
          <ChevronLeft size={18} aria-hidden /> Gimnasios
        </Link>
        <h1 className="titulo-pagina">Nuevo gimnasio</h1>
      </header>

      <form className={estilos.formulario} onSubmit={enviar} noValidate>
        {errorGeneral && (
          <p className="alerta-error" role="alert">
            {errorGeneral}
          </p>
        )}

        <fieldset className={estilos.grupo}>
          <legend>Gimnasio</legend>
          <Campo
            etiqueta="Nombre"
            error={errores.gimnasio?.nombre?.message}
            {...r('gimnasio.nombre', {
              onChange: (evento: { target: { value: string } }) => {
                if (!codigoEditado) {
                  formulario.setValue('gimnasio.slug', sugerirCodigo(evento.target.value));
                }
              },
            })}
          />
          <Campo
            etiqueta="Código"
            ayuda="Va en el link de ingreso: /g/codigo. No se puede cambiar después."
            autoCapitalize="none"
            spellCheck={false}
            error={errores.gimnasio?.slug?.message}
            {...r('gimnasio.slug', { onChange: () => setCodigoEditado(true) })}
          />
        </fieldset>

        <fieldset className={estilos.grupo}>
          <legend>Dueño</legend>
          <p className={`texto-suave ${estilos.ancho}`}>
            El usuario con el que el dueño entra al panel. Pasale la contraseña por un medio seguro;
            después puede cargar su logo y colores desde Configuración.
          </p>
          <Campo etiqueta="Nombre" error={errores.dueno?.nombre?.message} {...r('dueno.nombre')} />
          <Campo
            etiqueta="Email"
            type="email"
            autoComplete="off"
            error={errores.dueno?.email?.message}
            {...r('dueno.email')}
          />
          <Campo
            etiqueta="Contraseña inicial"
            type="password"
            autoComplete="new-password"
            ayuda="Mínimo 8 caracteres"
            error={errores.dueno?.contrasena?.message}
            {...r('dueno.contrasena')}
          />
        </fieldset>

        <div className={estilos.botonera}>
          <button type="submit" className="boton boton-principal" disabled={enviando}>
            {enviando ? 'Creando…' : 'Crear gimnasio'}
          </button>
          <Link to="/admin" className="boton boton-secundario">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
