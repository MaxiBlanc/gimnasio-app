import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { esquemaLoginStaff, type GimnasioSesion } from '@gimnasio/compartido';
import { ErrorApi, pedir } from '../api/cliente';
import { mostrarErrorEnFormulario } from '../api/formularios';
import { Campo } from '../componentes/Campo';
import { PantallaIngreso } from '../componentes/PantallaIngreso';
import { useSesion } from '../sesion/sesion';
import { guardarUltimoGimnasio } from '../sesion/ultimoGimnasio';
import { aplicarMarca, MARCA_APP } from '../tema/marca';
import estilos from './ingreso.module.css';

// El formulario no pide el gimnasio: sale de la URL (/g/power-gym).
const esquemaFormulario = esquemaLoginStaff.omit({ gimnasio: true });

export function LoginStaff() {
  const { slug = '' } = useParams();
  const { usuario, ingresarStaff } = useSesion();
  const navegar = useNavigate();
  const [errorGeneral, setErrorGeneral] = useState<string>();

  // Pedimos la marca ANTES de loguearse, para mostrar la pantalla con sus colores.
  const marca = useQuery({
    queryKey: ['marca', slug],
    queryFn: () => pedir<GimnasioSesion>(`/publico/gimnasios/${slug}`, { sinSesion: true }),
  });

  useEffect(() => {
    aplicarMarca(marca.data ?? MARCA_APP);
  }, [marca.data]);

  const formulario = useForm({ resolver: zodResolver(esquemaFormulario) });
  const { errors: errores, isSubmitting: enviando } = formulario.formState;

  // Si ya hay sesión en este gimnasio, no tiene sentido mostrar el login.
  if (usuario?.gimnasio?.slug === slug) return <Navigate to="/panel" replace />;

  if (marca.isError) {
    const noExiste = marca.error instanceof ErrorApi && marca.error.estado === 404;
    return (
      <PantallaIngreso nombre="Gimnasio App" colores={MARCA_APP}>
        <div className={estilos.encabezado}>
          <h1 className="titulo-pagina">
            {noExiste ? 'No encontramos ese gimnasio' : 'No pudimos cargar el gimnasio'}
          </h1>
          <p className="texto-suave">
            {noExiste
              ? `Revisá el código “${slug}”. Si el link te lo pasó tu gimnasio, pediles que te lo confirmen.`
              : marca.error.message}
          </p>
        </div>
        <Link className="boton boton-secundario" to="/">
          Elegir otro gimnasio
        </Link>
      </PantallaIngreso>
    );
  }

  const enviar = formulario.handleSubmit(async (datos) => {
    setErrorGeneral(undefined);
    try {
      const usuarioLogueado = await ingresarStaff({ ...datos, gimnasio: slug });
      if (usuarioLogueado.gimnasio) guardarUltimoGimnasio(usuarioLogueado.gimnasio);
      void navegar('/panel', { replace: true });
    } catch (error) {
      setErrorGeneral(mostrarErrorEnFormulario(error, formulario.setError));
    }
  });

  return (
    <PantallaIngreso
      nombre={marca.data?.nombre ?? ' '}
      logoUrl={marca.data?.logoUrl}
      colores={marca.data ?? MARCA_APP}
      pie={
        <>
          ¿No es tu gimnasio?{' '}
          <Link className={estilos.enlace} to="/">
            Elegir otro
          </Link>
        </>
      }
    >
      <div className={estilos.encabezado}>
        <h1 className="titulo-pagina">Ingresá al panel</h1>
        <p className="texto-suave">Para el equipo del gimnasio: dueño, recepción y profes.</p>
      </div>

      <form className={estilos.form} onSubmit={enviar} noValidate>
        {errorGeneral && (
          <p className="alerta-error" role="alert">
            {errorGeneral}
          </p>
        )}
        <Campo
          etiqueta="Email"
          type="email"
          autoComplete="username"
          autoFocus
          error={errores.email?.message}
          {...formulario.register('email')}
        />
        <Campo
          etiqueta="Contraseña"
          type="password"
          autoComplete="current-password"
          error={errores.contrasena?.message}
          {...formulario.register('contrasena')}
        />
        <button
          type="submit"
          className="boton boton-principal"
          disabled={enviando || marca.isPending}
        >
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </PantallaIngreso>
  );
}
