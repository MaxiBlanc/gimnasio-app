import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { esquemaContrasenaNueva, type GimnasioSesion } from '@gimnasio/compartido';
import { pedir } from '../api/cliente';
import { mostrarErrorEnFormulario } from '../api/formularios';
import { Campo } from '../componentes/Campo';
import { PantallaIngreso } from '../componentes/PantallaIngreso';
import { aplicarMarca, MARCA_APP } from '../tema/marca';
import estilos from './ingreso.module.css';

// Pedimos la contraseña dos veces: un error de tipeo acá dejaría al socio sin poder entrar.
const esquemaFormulario = z
  .object({ contrasena: esquemaContrasenaNueva, repetida: z.string() })
  .refine((datos) => datos.contrasena === datos.repetida, {
    path: ['repetida'],
    message: 'Las contraseñas no coinciden',
  });

/**
 * A esta pantalla llega el socio desde el mail de bienvenida:
 * /g/power-gym/activar?token=...  Elige su contraseña y su cuenta queda activa.
 */
export function ActivarCuenta() {
  const { slug = '' } = useParams();
  const [parametros] = useSearchParams();
  const token = parametros.get('token') ?? '';
  const [activada, setActivada] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string>();

  const marca = useQuery({
    queryKey: ['marca', slug],
    queryFn: () => pedir<GimnasioSesion>(`/publico/gimnasios/${slug}`, { sinSesion: true }),
  });
  useEffect(() => aplicarMarca(marca.data ?? MARCA_APP), [marca.data]);

  const formulario = useForm({ resolver: zodResolver(esquemaFormulario) });
  const { errors: errores, isSubmitting: enviando } = formulario.formState;

  const enviar = formulario.handleSubmit(async ({ contrasena }) => {
    setErrorGeneral(undefined);
    try {
      await pedir('/cuenta-socio/activar', {
        metodo: 'POST',
        cuerpo: { token, contrasena },
        sinSesion: true,
      });
      setActivada(true);
    } catch (error) {
      setErrorGeneral(mostrarErrorEnFormulario(error, formulario.setError));
    }
  });

  const nombreGimnasio = marca.data?.nombre ?? 'Gimnasio App';

  return (
    <PantallaIngreso
      nombre={marca.isPending ? ' ' : nombreGimnasio}
      logoUrl={marca.data?.logoUrl}
      colores={marca.data ?? MARCA_APP}
    >
      {!token ? (
        <div className={estilos.encabezado}>
          <h1 className="titulo-pagina">Falta el código del enlace</h1>
          <p className="texto-suave">
            Abrí el link completo que te llegó por mail. Si no lo encontrás, pedí uno nuevo en la
            recepción del gimnasio.
          </p>
        </div>
      ) : activada ? (
        <div className={estilos.encabezado} role="status">
          <h1 className="titulo-pagina">¡Listo, tu cuenta está activa!</h1>
          <p className="texto-suave">
            Desde ahora entrás con tu DNI y la contraseña que acabás de elegir.
          </p>
        </div>
      ) : (
        <>
          <div className={estilos.encabezado}>
            <h1 className="titulo-pagina">Creá tu contraseña</h1>
            <p className="texto-suave">
              Para entrar a {nombreGimnasio} desde el celular: ver tu cuota, tus rutinas y tus
              clases.
            </p>
          </div>
          <form className={estilos.form} onSubmit={enviar} noValidate>
            {errorGeneral && (
              <p className="alerta-error" role="alert">
                {errorGeneral}
              </p>
            )}
            <Campo
              etiqueta="Contraseña"
              type="password"
              autoComplete="new-password"
              ayuda="Mínimo 8 caracteres"
              autoFocus
              error={errores.contrasena?.message}
              {...formulario.register('contrasena')}
            />
            <Campo
              etiqueta="Repetí la contraseña"
              type="password"
              autoComplete="new-password"
              error={errores.repetida?.message}
              {...formulario.register('repetida')}
            />
            <button type="submit" className="boton boton-principal" disabled={enviando}>
              {enviando ? 'Guardando…' : 'Activar mi cuenta'}
            </button>
          </form>
        </>
      )}
    </PantallaIngreso>
  );
}
