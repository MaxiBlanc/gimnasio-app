import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { tieneRol, esquemaLoginAdmin } from '@gimnasio/compartido';
import { mostrarErrorEnFormulario } from '../api/formularios';
import { Campo } from '../componentes/Campo';
import { PantallaIngreso } from '../componentes/PantallaIngreso';
import { useSesion } from '../sesion/sesion';
import { aplicarMarca, MARCA_APP } from '../tema/marca';
import estilos from './ingreso.module.css';

export function LoginAdmin() {
  const { usuario, ingresarAdmin } = useSesion();
  const navegar = useNavigate();
  const [errorGeneral, setErrorGeneral] = useState<string>();
  const formulario = useForm({ resolver: zodResolver(esquemaLoginAdmin) });
  const { errors: errores, isSubmitting: enviando } = formulario.formState;

  useEffect(() => aplicarMarca(MARCA_APP), []);

  if (usuario && tieneRol(usuario, 'SUPERADMIN')) return <Navigate to="/admin" replace />;

  const enviar = formulario.handleSubmit(async (datos) => {
    setErrorGeneral(undefined);
    try {
      await ingresarAdmin(datos);
      void navegar('/admin', { replace: true });
    } catch (error) {
      setErrorGeneral(mostrarErrorEnFormulario(error, formulario.setError));
    }
  });

  return (
    <PantallaIngreso
      nombre="Gimnasio App"
      colores={MARCA_APP}
      pie={
        <>
          ¿Trabajás en un gimnasio?{' '}
          <Link className={estilos.enlace} to="/">
            Elegir gimnasio
          </Link>
        </>
      }
    >
      <div className={estilos.encabezado}>
        <h1 className="titulo-pagina">Administración</h1>
        <p className="texto-suave">Alta y gestión de los gimnasios que usan GimnasioApp.</p>
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
        <button type="submit" className="boton boton-principal" disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </PantallaIngreso>
  );
}
