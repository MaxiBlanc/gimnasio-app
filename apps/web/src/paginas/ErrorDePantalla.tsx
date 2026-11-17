import { Link, useRouteError } from 'react-router';

/**
 * Se muestra si una pantalla falla al dibujarse (un error de programación, no de la API).
 * Sin esto, React Router muestra su pantalla técnica de desarrollo.
 */
export function ErrorDePantalla() {
  const error = useRouteError();
  if (import.meta.env.DEV) console.error(error);
  return (
    <div style={{ display: 'grid', gap: '1rem', maxWidth: '32rem', padding: '2rem 1rem' }}>
      <h1 className="titulo-pagina">Algo salió mal en esta pantalla</h1>
      <p className="texto-suave">
        Recargá la página. Si vuelve a pasar, avisanos qué estabas haciendo así lo arreglamos.
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button type="button" className="boton boton-principal" onClick={() => location.reload()}>
          Recargar
        </button>
        <Link to="/" className="boton boton-secundario">
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
