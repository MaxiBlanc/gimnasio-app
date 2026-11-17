import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { esquemaSlug } from '@gimnasio/compartido';
import { Campo } from '../componentes/Campo';
import { PantallaIngreso } from '../componentes/PantallaIngreso';
import { MARCA_APP } from '../tema/marca';
import { leerUltimoGimnasio } from '../sesion/ultimoGimnasio';
import estilos from './ingreso.module.css';

/** Puerta de entrada: primero se elige el gimnasio, después se inicia sesión en él. */
export function ElegirGimnasio() {
  const navegar = useNavigate();
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<string>();
  const ultimo = leerUltimoGimnasio();

  const continuar = (evento: FormEvent) => {
    evento.preventDefault();
    const resultado = esquemaSlug.safeParse(codigo);
    if (!resultado.success) {
      setError(resultado.error.issues[0]?.message);
      return;
    }
    void navegar(`/g/${resultado.data}`);
  };

  return (
    <PantallaIngreso
      nombre="Gimnasio App"
      colores={MARCA_APP}
      pie={
        <>
          ¿Administrás GimnasioApp?{' '}
          <Link className={estilos.enlace} to="/admin/ingresar">
            Ingresar como súper-admin
          </Link>
        </>
      }
    >
      <div className={estilos.encabezado}>
        <h1 className="titulo-pagina">¿En qué gimnasio entrás?</h1>
        <p className="texto-suave">Cada gimnasio tiene su propio código y su propio equipo.</p>
      </div>

      {ultimo && (
        <Link className={estilos.continuar} to={`/g/${ultimo.slug}`}>
          <span>
            <strong>Seguir en {ultimo.nombre}</strong>
            <br />
            <span className="texto-suave">El último gimnasio que usaste acá</span>
          </span>
          <ChevronRight size={20} aria-hidden="true" />
        </Link>
      )}

      <form className={estilos.form} onSubmit={continuar} noValidate>
        <Campo
          etiqueta="Código del gimnasio"
          ayuda="Está al final del link de tu gimnasio. Por ejemplo: power-gym"
          value={codigo}
          onChange={(evento) => {
            setCodigo(evento.target.value);
            setError(undefined);
          }}
          error={error}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
        />
        <button type="submit" className="boton boton-principal">
          Continuar
        </button>
      </form>
    </PantallaIngreso>
  );
}
