import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { NOMBRE_APP } from '@gimnasio/compartido';
import { entorno } from './config/entorno';
import { manejarErrores, rutaNoEncontrada } from './middlewares/manejarErrores';
import { rutasAuth } from './modulos/auth/auth.rutas';
import { rutasAdmin } from './modulos/admin/admin.rutas';
import { rutasPlanes } from './modulos/planes/planes.rutas';
import { rutasDescuentos } from './modulos/descuentos/descuentos.rutas';
import { rutasCuentaSocio, rutasSocios } from './modulos/socios/socios.rutas';
import { rutasPagos, rutasPagosDeSocio } from './modulos/pagos/pagos.rutas';

/**
 * Crea la app de Express SIN ponerla a escuchar en un puerto.
 * Separarlo de servidor.ts nos deja usar la app en los tests (con Supertest)
 * y más adelante exportarla como función serverless en Vercel.
 */
export function crearApp() {
  const app = express();

  app.use(helmet()); // Headers HTTP de seguridad.
  app.use(cors({ origin: entorno.ORIGEN_WEB, credentials: true })); // Solo nuestro front puede llamarnos.
  app.use(express.json());
  app.use(cookieParser()); // Deja las cookies del pedido en req.cookies.

  app.get('/api/salud', (_req, res) => {
    res.json({ estado: 'ok', app: NOMBRE_APP });
  });

  app.use('/api/auth', rutasAuth);
  app.use('/api/admin', rutasAdmin);
  app.use('/api/planes', rutasPlanes);
  app.use('/api/descuentos', rutasDescuentos);
  // Lo más específico primero: /api/socios/:id/pagos antes que /api/socios.
  app.use('/api/socios/:id/pagos', rutasPagosDeSocio);
  app.use('/api/socios', rutasSocios);
  app.use('/api/cuenta-socio', rutasCuentaSocio);
  app.use('/api/pagos', rutasPagos);

  app.use(rutaNoEncontrada);
  app.use(manejarErrores);

  return app;
}
