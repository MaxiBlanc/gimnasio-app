import estilos from './Barras.module.css';

export interface Barra {
  /** Etiqueta corta debajo de la barra (puede ir vacía para no amontonar). */
  etiqueta: string;
  /** Texto completo para el tooltip y la tabla: "lunes 16/11". */
  detalle: string;
  valor: number;
  /** Resaltada con el color del gimnasio (por ejemplo, hoy). */
  destacada?: boolean;
}

interface Props {
  titulo: string;
  barras: Barra[];
  /** Cómo escribir un valor: "3 entradas", "1,5 por día". */
  formatear: (valor: number) => string;
}

/**
 * Gráfico de barras simple, hecho con HTML y CSS (sin librería): para una sola serie
 * alcanza y pesa cero. Cada barra muestra su valor al pasar el mouse; para lectores de
 * pantalla (y teclado) los mismos datos están en una tabla oculta.
 */
export function Barras({ titulo, barras, formatear }: Props) {
  const maximo = Math.max(...barras.map((b) => b.valor), 1);

  return (
    <figure className={estilos.figura}>
      <figcaption className={estilos.titulo}>{titulo}</figcaption>
      <div className={estilos.grafico} aria-hidden>
        {barras.map((barra) => (
          <div key={barra.detalle} className={estilos.columna}>
            <span className={estilos.tooltip}>
              <strong>{formatear(barra.valor)}</strong>
              {barra.detalle}
            </span>
            <div
              className={estilos.barra}
              data-destacada={barra.destacada}
              style={{ height: `${(barra.valor / maximo) * 100}%` }}
            />
            <span className={estilos.etiqueta}>{barra.etiqueta}</span>
          </div>
        ))}
      </div>
      <table className="solo-lector">
        <caption>{titulo}</caption>
        <tbody>
          {barras.map((barra) => (
            <tr key={barra.detalle}>
              <th scope="row">{barra.detalle}</th>
              <td>{formatear(barra.valor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
