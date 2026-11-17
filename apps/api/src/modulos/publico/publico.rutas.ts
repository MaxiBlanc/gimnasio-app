import { Router } from 'express';
import { esquemaSlug, type GimnasioSesion } from '@gimnasio/compartido';
import { z } from 'zod';
import { prisma } from '../../db';
import { ErrorApp } from '../../errores';

/**
 * Rutas públicas (sin login). Por ahora, una sola: los datos de marca de un gimnasio,
 * para que la pantalla de login ya se vea con su logo y sus colores ANTES de entrar.
 *
 * Solo devuelve lo que igual se ve en pantalla (nombre, logo, colores): nada de
 * configuración interna ni cantidades de socios.
 */
export const rutasPublicas = Router();

const esquemaParamSlug = z.object({ slug: esquemaSlug });

rutasPublicas.get('/gimnasios/:slug', async (req, res) => {
  const { slug } = esquemaParamSlug.parse(req.params);
  const gimnasio = await prisma.gimnasio.findUnique({
    where: { slug },
    select: {
      id: true,
      nombre: true,
      slug: true,
      logoUrl: true,
      colorPrimario: true,
      colorSecundario: true,
      activo: true,
    },
  });
  // Un gimnasio suspendido se trata igual que uno que no existe.
  if (!gimnasio || !gimnasio.activo) {
    throw new ErrorApp(404, 'GIMNASIO_NO_ENCONTRADO', 'No encontramos ese gimnasio');
  }
  const { activo: _activo, ...marca } = gimnasio;
  const cuerpo: GimnasioSesion = marca;
  res.json(cuerpo);
});
