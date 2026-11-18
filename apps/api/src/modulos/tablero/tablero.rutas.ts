import { Router } from 'express';
import { autenticar, obtenerGimnasioId, permitirRoles } from '../../middlewares/autenticar';
import { obtenerTablero } from './tablero.servicio';

export const rutasTablero = Router();

// Los números de plata y de uso del gimnasio son solo para el dueño.
rutasTablero.get('/', autenticar, permitirRoles('DUENO'), async (req, res) => {
  res.json(await obtenerTablero(obtenerGimnasioId(req)));
});
