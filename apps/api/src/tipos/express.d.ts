import type { DatosAuth } from '../modulos/auth/tokens';

/**
 * "Declaration merging": le agregamos a la interfaz Request de Express la propiedad `auth`,
 * que completa el middleware `autenticar`. Así `req.auth` queda tipado en toda la API.
 */
declare global {
  namespace Express {
    interface Request {
      auth?: DatosAuth;
    }
  }
}

export {};
