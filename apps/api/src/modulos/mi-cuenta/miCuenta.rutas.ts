import { Router } from 'express';
import {
  autenticar,
  obtenerAuth,
  obtenerGimnasioId,
  soloSocios,
} from '../../middlewares/autenticar';
import { listarRutinasDeSocio } from '../rutinas/rutinas.servicio';
import { obtenerMiCuenta } from './miCuenta.servicio';

/** Rutas del socio. El id sale del token: cada socio ve solo SU cuenta. */
export const rutasMiCuenta = Router();

rutasMiCuenta.get('/', autenticar, soloSocios, async (req, res) => {
  res.json(await obtenerMiCuenta(obtenerGimnasioId(req), obtenerAuth(req).usuarioId));
});

rutasMiCuenta.get('/rutinas', autenticar, soloSocios, async (req, res) => {
  res.json(await listarRutinasDeSocio(obtenerGimnasioId(req), obtenerAuth(req).usuarioId));
});
