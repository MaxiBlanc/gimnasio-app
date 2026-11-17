import type { RespuestaSesion } from '@gimnasio/compartido';

/**
 * Cliente de la API: un `fetch` con tres agregados.
 *
 * 1. Manda el token de acceso en el header Authorization.
 *    El token vive SOLO en memoria (una variable), no en localStorage: si alguien lograra
 *    inyectar JavaScript en la página (XSS), en localStorage lo podría leer y llevarse.
 *    Al recargar la página se pierde, pero se recupera con la cookie de refresco (httpOnly).
 *
 * 2. Si la API responde 401 (token vencido, duran 15 minutos), pide uno nuevo con la cookie
 *    y repite el pedido una vez. El usuario no se entera.
 *
 * 3. Convierte las respuestas de error en un `ErrorApi` con el código, el mensaje y
 *    los errores por campo, para mostrarlos en los formularios.
 */

export interface ErrorDeCampo {
  campo: string;
  mensaje: string;
}

export class ErrorApi extends Error {
  constructor(
    readonly estado: number,
    readonly codigo: string,
    mensaje: string,
    readonly campos: ErrorDeCampo[] = [],
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
  }
}

let tokenAcceso: string | null = null;

/** Quién quiere enterarse cuando la sesión cambia (la usa el contexto de sesión). */
type Oyente = (sesion: RespuestaSesion | null) => void;
const oyentes = new Set<Oyente>();

export function escucharSesion(oyente: Oyente): () => void {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

/** Guarda (o borra) la sesión y avisa a los oyentes. */
export function fijarSesion(sesion: RespuestaSesion | null) {
  tokenAcceso = sesion?.tokenAcceso ?? null;
  for (const oyente of oyentes) oyente(sesion);
}

/**
 * Pide un token nuevo usando la cookie de refresco.
 * Si varios pedidos fallan con 401 al mismo tiempo, comparten ESTE mismo refresco
 * (si cada uno refrescara por su cuenta, la rotación del token invalidaría a los demás).
 */
let refrescoEnCurso: Promise<RespuestaSesion | null> | null = null;

export function refrescarSesion(): Promise<RespuestaSesion | null> {
  refrescoEnCurso ??= fetch('/api/auth/refrescar', { method: 'POST' })
    .then(async (respuesta) =>
      respuesta.ok ? ((await respuesta.json()) as RespuestaSesion) : null,
    )
    .catch(() => null)
    .then((sesion) => {
      fijarSesion(sesion);
      return sesion;
    })
    .finally(() => {
      refrescoEnCurso = null;
    });
  return refrescoEnCurso;
}

interface OpcionesPedido {
  metodo?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  cuerpo?: unknown;
  /** Para pedidos que no llevan sesión (login, datos públicos). */
  sinSesion?: boolean;
}

export async function pedir<T>(ruta: string, opciones: OpcionesPedido = {}): Promise<T> {
  const hacerPedido = () => {
    const headers: Record<string, string> = {};
    if (opciones.cuerpo !== undefined) headers['Content-Type'] = 'application/json';
    if (tokenAcceso && !opciones.sinSesion) headers.Authorization = `Bearer ${tokenAcceso}`;
    return fetch(`/api${ruta}`, {
      method: opciones.metodo ?? 'GET',
      headers,
      body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
    });
  };

  let respuesta: Response;
  try {
    respuesta = await hacerPedido();
  } catch {
    throw new ErrorApi(0, 'SIN_CONEXION', 'No pudimos conectarnos. Revisá tu conexión a internet.');
  }

  if (respuesta.status === 401 && !opciones.sinSesion && tokenAcceso) {
    const sesion = await refrescarSesion();
    if (sesion) respuesta = await hacerPedido();
  }

  if (respuesta.status === 204) return undefined as T;

  const datos: unknown = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    const error = (
      datos as { error?: { codigo?: string; mensaje?: string; campos?: ErrorDeCampo[] } }
    )?.error;
    throw new ErrorApi(
      respuesta.status,
      error?.codigo ?? 'ERROR_DESCONOCIDO',
      error?.mensaje ?? 'Ocurrió un error inesperado',
      error?.campos,
    );
  }
  return datos as T;
}
