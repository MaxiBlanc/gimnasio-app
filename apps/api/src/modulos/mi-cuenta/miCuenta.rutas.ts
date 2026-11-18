import { Router } from 'express';
import {
  autenticar,
  obtenerAuth,
  obtenerGimnasioId,
  soloSocios,
} from '../../middlewares/autenticar';
import { esquemaFechaClase } from '@gimnasio/compartido';
import { esquemaParamId } from '../../validacion';
import { agendaDelSocio, anotarse, darseDeBaja } from '../clases/clases.servicio';
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

// Clases: ver la agenda, anotarse y darse de baja.
rutasMiCuenta.get('/clases', autenticar, soloSocios, async (req, res) => {
  res.json(await agendaDelSocio(obtenerGimnasioId(req), obtenerAuth(req).usuarioId));
});

rutasMiCuenta.post('/clases/:id/inscripcion', autenticar, soloSocios, async (req, res) => {
  const { id } = esquemaParamId.parse(req.params);
  const { fecha } = esquemaFechaClase.parse(req.body);
  await anotarse(obtenerGimnasioId(req), obtenerAuth(req).usuarioId, id, fecha);
  res.status(201).end();
});

rutasMiCuenta.delete('/clases/:id/inscripcion', autenticar, soloSocios, async (req, res) => {
  const { id } = esquemaParamId.parse(req.params);
  const { fecha } = esquemaFechaClase.parse(req.query);
  await darseDeBaja(obtenerGimnasioId(req), obtenerAuth(req).usuarioId, id, fecha);
  res.status(204).end();
});
