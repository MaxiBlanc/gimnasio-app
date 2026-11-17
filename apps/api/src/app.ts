import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { NOMBRE_APP } from '@gimnasio/compartido';
import { entorno } from './config/entorno';
import { manejarErrores, rutaNoEncontrada } from './middlewares/manejarErrores';

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

  app.get('/api/salud', (_req, res) => {
    res.json({ estado: 'ok', app: NOMBRE_APP });
  });

  app.use(rutaNoEncontrada);
  app.use(manejarErrores);

  return app;
}
