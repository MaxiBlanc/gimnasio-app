import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import {
  esquemaLoginSocio,
  esquemaLoginStaff,
  type GimnasioSesion,
  type RolSesion,
} from '@gimnasio/compartido';
import { ErrorApi, pedir } from '../api/cliente';
import { mostrarErrorEnFormulario } from '../api/formularios';
import { Campo } from '../componentes/Campo';
import { PantallaIngreso } from '../componentes/PantallaIngreso';
import { useSesion } from '../sesion/sesion';
import { guardarUltimoGimnasio } from '../sesion/ultimoGimnasio';
import { aplicarMarca, MARCA_APP } from '../tema/marca';
import estilos from './ingreso.module.css';

// Los formularios no piden el gimnasio: sale de la URL (/g/power-gym).
// El del personal pide email; el del socio, DNI. Un esquema que acepta los dos campos
// opcionales no validaría bien, así que elegimos uno u otro según la pantalla.
const esquemaStaff = esquemaLoginStaff.omit({ gimnasio: true });
const esquemaSocio = esquemaLoginSocio.omit({ gimnasio: true });

type DatosFormulario = { email?: string; dni?: string; contrasena: string };

interface Props {
  /** true: login del socio (/g/:slug/socio). false: login del personal (/g/:slug). */
  socio?: boolean;
}

/** Login dentro de un gimnasio, con su marca. Sirve para el personal y para los socios. */
export function LoginStaff({ socio = false }: Props) {
  const { slug = '' } = useParams();
  const { usuario, ingresarStaff, ingresarSocio } = useSesion();
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

  // `useForm` necesita UN tipo de datos: { email?, dni?, contrasena }. El resolver valida con el
  // esquema que corresponde, así que en la práctica solo llega el campo de esta pantalla.
  const formulario = useForm<DatosFormulario>({
    resolver: zodResolver(socio ? esquemaSocio : esquemaStaff) as Resolver<DatosFormulario>,
  });
  // A dónde va cada uno al entrar. La tablet de la entrada, directo a su pantalla.
  const destinoDe = (rol: RolSesion) =>
    rol === 'SOCIO' ? '/socio' : rol === 'KIOSCO' ? '/ingreso' : '/panel';
  const { errors: errores, isSubmitting: enviando } = formulario.formState;

  // Si ya hay sesión en este gimnasio, no tiene sentido mostrar el login.
  const esSocio = usuario?.rol === 'SOCIO';
  if (usuario?.gimnasio?.slug === slug && esSocio === socio) {
    return <Navigate to={destinoDe(usuario.rol)} replace />;
  }

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
      const usuarioLogueado = socio
        ? await ingresarSocio({
            dni: datos.dni ?? '',
            contrasena: datos.contrasena,
            gimnasio: slug,
          })
        : await ingresarStaff({
            email: datos.email ?? '',
            contrasena: datos.contrasena,
            gimnasio: slug,
          });
      if (usuarioLogueado.gimnasio) guardarUltimoGimnasio(usuarioLogueado.gimnasio);

      void navegar(destinoDe(usuarioLogueado.rol), { replace: true });
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
          {socio ? '¿Trabajás en el gimnasio?' : '¿Sos socio/a?'}{' '}
          <Link className={estilos.enlace} to={socio ? `/g/${slug}` : `/g/${slug}/socio`}>
            {socio ? 'Entrá al panel' : 'Entrá a tu cuenta'}
          </Link>
          <br />
          ¿No es tu gimnasio?{' '}
          <Link className={estilos.enlace} to="/">
            Elegir otro
          </Link>
        </>
      }
    >
      <div className={estilos.encabezado}>
        <h1 className="titulo-pagina">{socio ? 'Tu cuenta' : 'Ingresá al panel'}</h1>
        <p className="texto-suave">
          {socio
            ? 'Mirá tu cuota, tus pagos y cuánta gente hay en el gimnasio.'
            : 'Para el equipo del gimnasio: dueño, recepción y profes.'}
        </p>
      </div>

      <form className={estilos.form} onSubmit={enviar} noValidate>
        {errorGeneral && (
          <p className="alerta-error" role="alert">
            {errorGeneral}
          </p>
        )}
        {socio ? (
          <Campo
            etiqueta="DNI"
            inputMode="numeric"
            autoComplete="username"
            autoFocus
            error={errores.dni?.message}
            {...formulario.register('dni')}
          />
        ) : (
          <Campo
            etiqueta="Email"
            type="email"
            autoComplete="username"
            autoFocus
            error={errores.email?.message}
            {...formulario.register('email')}
          />
        )}
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
