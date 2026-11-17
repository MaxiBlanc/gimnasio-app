import { z } from 'zod';

/** Valida el `:id` de la URL. Un id que no es UUID ni llega a la base: responde 400. */
export const esquemaParamId = z.object({ id: z.uuid('Id inválido') });
