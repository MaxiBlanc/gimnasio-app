import { Router } from 'express';
import { esquemaConfiguracionGimnasio } from '@gimnasio/compartido';
import { autenticar, obtenerGimnasioId, permitirRoles } from '../../middlewares/autenticar';
import { editarConfiguracion, obtenerConfiguracion } from './miGimnasio.servicio';

export const rutasMiGimnasio = Router();

rutasMiGimnasio.use(autenticar);

// Leer: todo el personal (la web usa el logo y los colores en todas las pantallas).
rutasMiGimnasio.get(
  '/',
  permitirRoles('DUENO', 'RECEPCION', 'PROFESOR', 'KIOSCO'),
  async (req, res) => {
    res.json(await obtenerConfiguracion(obtenerGimnasioId(req)));
  },
);

// Modificar: solo el dueño.
rutasMiGimnasio.patch('/', permitirRoles('DUENO'), async (req, res) => {
  const datos = esquemaConfiguracionGimnasio.parse(req.body);
  res.json(await editarConfiguracion(obtenerGimnasioId(req), datos));
});
