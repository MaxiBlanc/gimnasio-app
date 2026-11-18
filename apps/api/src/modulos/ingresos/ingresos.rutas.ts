import { Router } from 'express';
import { esquemaRegistrarIngreso } from '@gimnasio/compartido';
import { autenticar, obtenerGimnasioId, permitirRoles } from '../../middlewares/autenticar';
import { obtenerOcupacion, registrarIngreso } from './ingresos.servicio';

export const rutasIngresos = Router();

// La tablet de la entrada (KIOSCO). Recepción y el dueño también, por si la tablet no anda.
rutasIngresos.post(
  '/',
  autenticar,
  permitirRoles('KIOSCO', 'RECEPCION', 'DUENO'),
  async (req, res) => {
    const datos = esquemaRegistrarIngreso.parse(req.body);
    res.status(201).json(await registrarIngreso(obtenerGimnasioId(req), datos));
  },
);

export const rutasOcupacion = Router();

// La ocupación la puede ver cualquiera del gimnasio, socios incluidos
// (obtenerGimnasioId usa el gimnasio del token, nunca uno que venga en el pedido).
rutasOcupacion.get('/', autenticar, async (req, res) => {
  res.json(await obtenerOcupacion(obtenerGimnasioId(req)));
});
