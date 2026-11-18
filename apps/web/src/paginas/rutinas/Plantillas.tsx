import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import type { ResumenRutina } from '@gimnasio/compartido';
import { pedir } from '../../api/cliente';
import estilos from '../paginas.module.css';
import propios from './rutinas.module.css';

/** "3 días · 14 ejercicios" */
export function resumenRutina(rutina: { cantidadDias: number; cantidadEjercicios: number }) {
  const dias = `${rutina.cantidadDias} ${rutina.cantidadDias === 1 ? 'día' : 'días'}`;
  const ejercicios = `${rutina.cantidadEjercicios} ${rutina.cantidadEjercicios === 1 ? 'ejercicio' : 'ejercicios'}`;
  return `${dias} · ${ejercicios}`;
}

/** Plantillas de rutinas del gimnasio: se arman una vez y se asignan a muchos socios. */
export function Plantillas() {
  const plantillas = useQuery({
    queryKey: ['rutinas', 'plantillas'],
    queryFn: () => pedir<ResumenRutina[]>('/rutinas/plantillas'),
  });

  return (
    <div className={estilos.pagina}>
      <header className={estilos.encabezado}>
        <div>
          <h1 className="titulo-pagina">Rutinas</h1>
          <p className="texto-suave">
            Plantillas para asignar a los socios. Al asignarla se crea una copia: la podés ajustar
            para cada socio sin cambiar la plantilla.
          </p>
        </div>
        <div className={estilos.acciones}>
          <Link className="boton boton-principal" to="/panel/rutinas/nueva">
            <Plus size={18} aria-hidden /> Nueva plantilla
          </Link>
        </div>
      </header>

      {plantillas.isPending && <p className="texto-suave">Cargando…</p>}
      {plantillas.isError && <p className="alerta-error">{plantillas.error.message}</p>}
      {plantillas.data?.length === 0 && (
        <p className={`texto-suave ${estilos.vacio}`}>
          Todavía no hay plantillas. Armá la primera (por ejemplo, &quot;Principiante 3 días&quot;).
        </p>
      )}
      {plantillas.data && plantillas.data.length > 0 && (
        <ul className={propios.tarjetas}>
          {plantillas.data.map((plantilla) => (
            <li key={plantilla.id}>
              <Link className={propios.tarjeta} to={`/panel/rutinas/${plantilla.id}`}>
                <span className={propios.nombre}>{plantilla.nombre}</span>
                {plantilla.descripcion && (
                  <span className="texto-suave">{plantilla.descripcion}</span>
                )}
                <span className={propios.meta}>{resumenRutina(plantilla)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
