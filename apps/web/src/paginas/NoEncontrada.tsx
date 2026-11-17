import { Link } from 'react-router';
import { PantallaIngreso } from '../componentes/PantallaIngreso';
import { MARCA_APP } from '../tema/marca';

export function NoEncontrada() {
  return (
    <PantallaIngreso nombre="404" colores={MARCA_APP}>
      <h1 className="titulo-pagina">Esta página no existe</h1>
      <p className="texto-suave" style={{ margin: '0.5rem 0 1.5rem' }}>
        Puede que el link esté mal escrito o que la página se haya movido.
      </p>
      <Link className="boton boton-secundario" to="/">
        Ir al inicio
      </Link>
    </PantallaIngreso>
  );
}
