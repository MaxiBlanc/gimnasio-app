import type { Request, RequestHandler } from 'express';
import type { Rol, RolSesion } from '@gimnasio/compartido';
import { ErrorApp } from '../errores';
import { type DatosAuth, verificarTokenAcceso } from '../modulos/auth/tokens';

const noAutenticado = () => new ErrorApp(401, 'NO_AUTENTICADO', 'Tenés que iniciar sesión');

/**
 * Exige un token de acceso válido en el header `Authorization: Bearer <token>`
 * y deja los datos del usuario en `req.auth`.
 */
export const autenticar: RequestHandler = (req, _res, next) => {
  const [tipo, token] = req.headers.authorization?.split(' ') ?? [];
  if (tipo !== 'Bearer' || !token) throw noAutenticado();

  const datos = verificarTokenAcceso(token);
  if (!datos) throw noAutenticado();

  req.auth = datos;
  next();
};

/**
 * Deja pasar solo a los roles indicados. Va DESPUÉS de `autenticar`:
 *   router.get('/reportes', autenticar, permitirRoles('DUENO'), handler)
 * 401 = no sé quién sos. 403 = sé quién sos, pero no tenés permiso.
 *
 * Recibe roles del PERSONAL (`Rol`), así que un socio nunca pasa por acá: las rutas del
 * panel quedan cerradas para los socios sin tener que acordarse de excluirlos.
 */
export function permitirRoles(...roles: Rol[]): RequestHandler {
  const permitidos: readonly RolSesion[] = roles;
  return (req, _res, next) => {
    const { rol } = obtenerAuth(req);
    if (!permitidos.includes(rol)) {
      throw new ErrorApp(403, 'SIN_PERMISO', 'No tenés permiso para hacer esto');
    }
    next();
  };
}

/** Devuelve `req.auth` ya garantizado (o 401). Evita andar chequeando `undefined` en cada ruta. */
export function obtenerAuth(req: Request): DatosAuth {
  if (!req.auth) throw noAutenticado();
  return req.auth;
}

/**
 * Devuelve el gimnasio del usuario logueado. TODAS las consultas de datos de un gimnasio
 * deben usar este valor (nunca uno que venga en el body o la URL): así nadie puede
 * pedir datos de otro gimnasio cambiando un id en el pedido.
 */
export function obtenerGimnasioId(req: Request): string {
  const { gimnasioId } = obtenerAuth(req);
  if (!gimnasioId) {
    throw new ErrorApp(403, 'SIN_GIMNASIO', 'Esta acción es solo para usuarios de un gimnasio');
  }
  return gimnasioId;
}

/** Solo socios (rutas de "mi cuenta"). Va después de `autenticar`. */
export const soloSocios: RequestHandler = (req, _res, next) => {
  if (obtenerAuth(req).rol !== 'SOCIO') {
    throw new ErrorApp(403, 'SIN_PERMISO', 'Esta sección es solo para socios');
  }
  next();
};
