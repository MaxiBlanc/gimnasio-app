import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Delete, LogOut } from 'lucide-react';
import type { EstadoCuota, ResultadoIngreso, UsuarioSesion } from '@gimnasio/compartido';
import { ErrorApi, pedir } from '../../api/cliente';
import { Ocupacion } from '../../componentes/Ocupacion';
import { formatearFecha } from '../../formato';
import { useSesion } from '../../sesion/sesion';
import { aplicarMarca, MARCA_APP } from '../../tema/marca';
import estilos from './TabletIngreso.module.css';

/** Cuánto queda el resultado en pantalla antes de volver al teclado. */
const SEGUNDOS_RESULTADO = 5;
const SEGUNDOS_RESULTADO_CON_AVISO = 8;

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

function mensaje(estado: EstadoCuota, vencimiento: string | null) {
  switch (estado) {
    case 'AL_DIA':
      return { titulo: '¡Adelante!', detalle: 'Tu cuota está al día.' };
    case 'POR_VENCER':
      return {
        titulo: '¡Adelante!',
        detalle: `Tu cuota vence el ${vencimiento ? formatearFecha(vencimiento) : ''}. Acordate de renovar.`,
      };
    case 'PENDIENTE':
      return { titulo: '¡Adelante!', detalle: 'Recordá pagar la cuota de este mes.' };
    case 'VENCIDO':
      return { titulo: 'Cuota vencida', detalle: 'Pasá por recepción antes de entrenar.' };
  }
}

/**
 * Pantalla de la tablet de la entrada (rol KIOSCO). El socio escribe su DNI y la app le
 * dice si está al día. Pensada para quedar abierta todo el día: después de cada ingreso
 * vuelve sola al teclado.
 */
export function TabletIngreso({ usuario }: { usuario: UsuarioSesion }) {
  const { salir } = useSesion();
  const navegar = useNavigate();
  const [dni, setDni] = useState('');
  const gimnasio = usuario.gimnasio;
  const reinicio = useRef<number>(undefined);
  const clienteQuery = useQueryClient();

  useEffect(() => aplicarMarca(gimnasio ?? MARCA_APP), [gimnasio]);

  const ingreso = useMutation({
    mutationFn: (documento: string) =>
      pedir<ResultadoIngreso>('/ingresos', { metodo: 'POST', cuerpo: { dni: documento } }),
    // Entró alguien: la ocupación cambió.
    onSuccess: () => clienteQuery.invalidateQueries({ queryKey: ['ocupacion'] }),
  });

  const limpiar = () => {
    window.clearTimeout(reinicio.current);
    setDni('');
    ingreso.reset();
  };

  const enviar = () => {
    if (dni.length < 7 || ingreso.isPending) return;
    ingreso.mutate(dni, {
      onSettled: (resultado) => {
        const conAviso = !resultado || resultado.cuota.estado === 'VENCIDO';
        const segundos = conAviso ? SEGUNDOS_RESULTADO_CON_AVISO : SEGUNDOS_RESULTADO;
        reinicio.current = window.setTimeout(limpiar, segundos * 1000);
      },
    });
  };

  const tocar = (tecla: string) => {
    if (ingreso.isSuccess || ingreso.isError) return;
    setDni((actual) => (actual.length < 8 ? actual + tecla : actual));
  };
  const borrar = () => setDni((actual) => actual.slice(0, -1));

  // También funciona con un teclado físico (o un lector de código de barras del DNI).
  // Guardamos los handlers en una ref para que el listener siempre use la versión actual.
  const teclado = useRef({ tocar, borrar, enviar, limpiar });
  useEffect(() => {
    teclado.current = { tocar, borrar, enviar, limpiar };
  });
  useEffect(() => {
    const alPresionar = (evento: KeyboardEvent) => {
      const acciones = teclado.current;
      if (/^\d$/.test(evento.key)) acciones.tocar(evento.key);
      else if (evento.key === 'Backspace') acciones.borrar();
      else if (evento.key === 'Enter') acciones.enviar();
      else if (evento.key === 'Escape') acciones.limpiar();
    };
    window.addEventListener('keydown', alPresionar);
    return () => {
      window.removeEventListener('keydown', alPresionar);
      window.clearTimeout(reinicio.current);
    };
  }, []);

  const cerrarSesion = async () => {
    await salir();
    void navegar(gimnasio ? `/g/${gimnasio.slug}` : '/', { replace: true });
  };

  const resultado = ingreso.data;
  const error = ingreso.error;

  return (
    <div className={estilos.pantalla}>
      <header className={estilos.barra}>
        <span className={`titular ${estilos.nombre}`}>{gimnasio?.nombre}</span>
        <button
          type="button"
          className="boton boton-fantasma boton-icono"
          onClick={cerrarSesion}
          title="Cerrar sesión de la tablet"
          aria-label="Cerrar sesión de la tablet"
        >
          <LogOut size={18} aria-hidden />
        </button>
      </header>

      <main className={estilos.contenido}>
        {resultado ? (
          <button
            type="button"
            className={estilos.resultado}
            data-estado={resultado.cuota.estado}
            onClick={limpiar}
            aria-live="assertive"
          >
            <span className={estilos.saludo}>Hola, {resultado.socio.nombre}</span>
            <span className={`titular ${estilos.tituloResultado}`}>
              {mensaje(resultado.cuota.estado, resultado.cuota.vencimiento).titulo}
            </span>
            <span className={estilos.detalle}>
              {mensaje(resultado.cuota.estado, resultado.cuota.vencimiento).detalle}
            </span>
            <span className={estilos.tocar}>Tocá para continuar</span>
          </button>
        ) : error ? (
          <button
            type="button"
            className={estilos.resultado}
            data-estado="VENCIDO"
            onClick={limpiar}
            aria-live="assertive"
          >
            <span className={`titular ${estilos.tituloResultado}`}>
              {error instanceof ErrorApi && error.estado === 404 ? 'DNI no encontrado' : 'Ups'}
            </span>
            <span className={estilos.detalle}>{error.message}</span>
            <span className={estilos.tocar}>Tocá para volver a intentar</span>
          </button>
        ) : (
          <div className={estilos.marcador}>
            <h1 className={`titular ${estilos.pedido}`}>Ingresá tu DNI</h1>
            <output className={`numero ${estilos.visor}`} aria-live="polite">
              {dni || <span className={estilos.vacio}>sin puntos</span>}
            </output>
            <div className={estilos.teclado}>
              {TECLAS.map((tecla) => (
                <button
                  key={tecla}
                  type="button"
                  className={estilos.tecla}
                  onClick={() => tocar(tecla)}
                >
                  {tecla}
                </button>
              ))}
              <button
                type="button"
                className={`${estilos.tecla} ${estilos.secundaria}`}
                onClick={borrar}
                aria-label="Borrar"
              >
                <Delete aria-hidden />
              </button>
              <button type="button" className={estilos.tecla} onClick={() => tocar('0')}>
                0
              </button>
              <button
                type="button"
                className={`${estilos.tecla} ${estilos.ok}`}
                onClick={enviar}
                disabled={dni.length < 7 || ingreso.isPending}
              >
                {ingreso.isPending ? '…' : 'OK'}
              </button>
            </div>
          </div>
        )}

        <aside className={estilos.lateral}>
          <Ocupacion />
        </aside>
      </main>
    </div>
  );
}
