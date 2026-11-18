import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { entorno } from '../../config/entorno';
import { ErrorApp } from '../../errores';
import { enviarAvisosDeCuota } from './avisos.servicio';

/**
 * Rutas que llama el cron de Vercel (no las personas). Vercel manda el header
 * `Authorization: Bearer <CRON_SECRET>`; sin ese secreto, nadie más puede dispararlas.
 */
export const rutasCron = Router();

function esElCron(autorizacion: string | undefined): boolean {
  if (!entorno.CRON_SECRET || !autorizacion) return false;
  const esperado = Buffer.from(`Bearer ${entorno.CRON_SECRET}`);
  const recibido = Buffer.from(autorizacion);
  // Comparación en tiempo constante: no revela cuántos caracteres acertó quien prueba.
  return esperado.length === recibido.length && timingSafeEqual(esperado, recibido);
}

rutasCron.get('/avisos', async (req, res) => {
  if (!esElCron(req.headers.authorization)) {
    throw new ErrorApp(401, 'NO_AUTENTICADO', 'Solo para el cron');
  }
  res.json(await enviarAvisosDeCuota());
});
