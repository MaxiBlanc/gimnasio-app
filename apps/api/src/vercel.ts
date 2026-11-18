import { crearApp } from './app';

/**
 * Punto de entrada en Vercel. Allá no hay un servidor escuchando un puerto (servidor.ts):
 * cada pedido a /api/... ejecuta esta función, que es la misma app de Express.
 * Una app de Express ya es una función (req, res), así que alcanza con exportarla.
 */
export default crearApp();
