import type { DiaRutina } from '@gimnasio/compartido';
import estilos from './rutinas.module.css';

/** Una rutina para leer (el socio en el celular, o la ficha en el panel). */
export function RutinaLectura({ dias }: { dias: DiaRutina[] }) {
  return (
    <div className={estilos.lectura}>
      {dias.map((dia, i) => (
        <section key={i} className={estilos.diaLectura}>
          <h3>{dia.nombre}</h3>
          <ol className={estilos.listaLectura}>
            {dia.ejercicios.map((ejercicio, j) => (
              <li key={j}>
                <span>
                  <strong>{ejercicio.nombre}</strong>{' '}
                  <span className={estilos.esquema}>
                    {ejercicio.series} × {ejercicio.repeticiones}
                  </span>
                </span>
                {(ejercicio.descanso || ejercicio.notas) && (
                  <span className={estilos.meta}>
                    {[ejercicio.descanso && `Descanso ${ejercicio.descanso}`, ejercicio.notas]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
