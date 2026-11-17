/**
 * Error "esperado" de la aplicación: lo lanzamos a propósito cuando algo no se puede hacer
 * (ej. socio no encontrado, sin permisos). Lleva el código HTTP que corresponde.
 * Cualquier otro error es un bug y se responde como 500.
 */
export class ErrorApp extends Error {
  constructor(
    public readonly estadoHttp: number,
    public readonly codigo: string,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorApp';
  }
}
