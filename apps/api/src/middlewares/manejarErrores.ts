import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { ErrorApp } from '../errores';
import { Prisma } from '../generated/prisma/client';

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

  // Red de seguridad: si la base rechaza un dato duplicado (restricción UNIQUE),
  // respondemos 409 en vez de 500. Pasa, por ejemplo, si dos pedidos crean lo mismo a la vez.
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    res
      .status(409)
      .json({ error: { codigo: 'YA_EXISTE', mensaje: 'Ya existe un registro con esos datos' } });
    return;
  }

  // Datos inválidos según un esquema de Zod: 400 con el detalle de cada campo,
  // así la web puede mostrar el error al lado del input correspondiente.
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        codigo: 'DATOS_INVALIDOS',
        mensaje: 'Revisá los datos ingresados',
        campos: error.issues.map((problema) => ({
          campo: problema.path.join('.'),
          mensaje: problema.message,
        })),
      },
    });
    return;
  }

  // El body no es un JSON válido (lo detecta express.json()).
  if (error instanceof SyntaxError && 'body' in error) {
    res
      .status(400)
      .json({ error: { codigo: 'JSON_INVALIDO', mensaje: 'El cuerpo no es un JSON válido' } });
    return;
  }

  console.error(error);
  // Nunca devolvemos el detalle de un error inesperado: podría filtrar información interna.
  res
    .status(500)
    .json({ error: { codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error inesperado' } });
};
