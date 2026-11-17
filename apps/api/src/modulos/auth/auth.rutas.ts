import { Router, type CookieOptions, type Response } from 'express';
import { esquemaLoginAdmin, esquemaLoginStaff, type RespuestaSesion } from '@gimnasio/compartido';
import { entorno } from '../../config/entorno';
import { autenticar, obtenerAuth } from '../../middlewares/autenticar';
import {
  cerrarSesion,
  iniciarSesionAdmin,
  iniciarSesionStaff,
  obtenerUsuarioSesion,
  refrescarSesion,
  type SesionIniciada,
} from './auth.servicio';
import { NOMBRE_COOKIE_REFRESCO } from './tokens';

/**
 * Opciones de la cookie del token de refresco:
 * - httpOnly: el JavaScript de la página no la puede leer (protege de XSS).
 * - secure: en producción solo viaja por HTTPS.
 * - sameSite strict: el navegador no la manda en pedidos que vienen de otros sitios (protege de CSRF).
 * - path: solo se manda a /api/auth, no a cada pedido de la API.
 */
const opcionesCookie: CookieOptions = {
  httpOnly: true,
  secure: entorno.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api/auth',
};

/** Pone el token de refresco en la cookie y devuelve el resto como JSON. */
function responderSesion(res: Response, sesion: SesionIniciada) {
  res.cookie(NOMBRE_COOKIE_REFRESCO, sesion.tokenRefresco, {
    ...opcionesCookie,
    maxAge: entorno.DIAS_TOKEN_REFRESCO * 24 * 60 * 60 * 1000,
  });
  const cuerpo: RespuestaSesion = { tokenAcceso: sesion.tokenAcceso, usuario: sesion.usuario };
  res.json(cuerpo);
}

export const rutasAuth = Router();

// Las rutas solo traducen HTTP ↔ servicio: validan la entrada y arman la respuesta.
// La lógica vive en auth.servicio.ts.

rutasAuth.post('/login', async (req, res) => {
  const datos = esquemaLoginStaff.parse(req.body); // si es inválido, lanza ZodError → 400
  responderSesion(res, await iniciarSesionStaff(datos));
});

rutasAuth.post('/admin/login', async (req, res) => {
  const datos = esquemaLoginAdmin.parse(req.body);
  responderSesion(res, await iniciarSesionAdmin(datos));
});

rutasAuth.post('/refrescar', async (req, res) => {
  const token: string | undefined = req.cookies[NOMBRE_COOKIE_REFRESCO];
  try {
    responderSesion(res, await refrescarSesion(token));
  } catch (error) {
    // Si el token no sirve, borramos la cookie para que el navegador no lo siga mandando.
    res.clearCookie(NOMBRE_COOKIE_REFRESCO, opcionesCookie);
    throw error;
  }
});

rutasAuth.post('/salir', async (req, res) => {
  await cerrarSesion(req.cookies[NOMBRE_COOKIE_REFRESCO]);
  res.clearCookie(NOMBRE_COOKIE_REFRESCO, opcionesCookie);
  res.status(204).end();
});

rutasAuth.get('/yo', autenticar, async (req, res) => {
  res.json(await obtenerUsuarioSesion(obtenerAuth(req).usuarioId));
});
