import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ErrorApp } from '../errores';

/** Responde 404 a cualquier ruta que no exista. */
export const rutaNoEncontrada: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { codigo: 'NO_ENCONTRADO', mensaje: 'Ruta no encontrada' } });
};

/**
 * Último middleware de la cadena: todos los errores terminan acá.
 * En Express 5, si un handler async lanza un error, llega acá solo (no hace falta try/catch).
 * Express lo reconoce como manejador de errores porque recibe 4 parámetros.
 */
export const manejarErrores: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ErrorApp) {
    res.status(error.estadoHttp).json({ error: { codigo: error.codigo, mensaje: error.message } });
    return;
  }

  console.error(error);
  // Nunca devolvemos el detalle de un error inesperado: podría filtrar información interna.
  res
    .status(500)
    .json({ error: { codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error inesperado' } });
};
