import { Router } from 'express';
import { esquemaAsignarRutina, esquemaGuardarRutina } from '@gimnasio/compartido';
import {
  autenticar,
  obtenerAuth,
  obtenerGimnasioId,
  permitirRoles,
} from '../../middlewares/autenticar';
import { esquemaParamId } from '../../validacion';
import {
  asignarRutina,
  crearPlantilla,
  editarRutina,
  eliminarRutina,
  listarPlantillas,
  listarRutinasDeSocio,
  obtenerRutina,
} from './rutinas.servicio';

// Las rutinas las arman el profe y el dueño.
export const rutasRutinas = Router();
rutasRutinas.use(autenticar, permitirRoles('DUENO', 'PROFESOR'));

rutasRutinas.get('/plantillas', async (req, res) => {
  res.json(await listarPlantillas(obtenerGimnasioId(req)));
});

rutasRutinas.post('/plantillas', async (req, res) => {
  const datos = esquemaGuardarRutina.parse(req.body);
  res
    .status(201)
    .json(await crearPlantilla(obtenerGimnasioId(req), obtenerAuth(req).usuarioId, datos));
});

rutasRutinas.get('/:id', async (req, res) => {
  const { id } = esquemaParamId.parse(req.params);
  res.json(await obtenerRutina(obtenerGimnasioId(req), id));
});

rutasRutinas.put('/:id', async (req, res) => {
  const { id } = esquemaParamId.parse(req.params);
  const datos = esquemaGuardarRutina.parse(req.body);
  res.json(await editarRutina(obtenerGimnasioId(req), id, datos));
});

rutasRutinas.delete('/:id', async (req, res) => {
  const { id } = esquemaParamId.parse(req.params);
  await eliminarRutina(obtenerGimnasioId(req), id);
  res.status(204).end();
});

// /api/socios/:id/rutinas — mergeParams para leer el :id del socio.
export const rutasRutinasDeSocio = Router({ mergeParams: true });
rutasRutinasDeSocio.use(autenticar, permitirRoles('DUENO', 'PROFESOR'));

rutasRutinasDeSocio.get('/', async (req, res) => {
  const { id } = esquemaParamId.parse(req.params);
  res.json(await listarRutinasDeSocio(obtenerGimnasioId(req), id));
});

rutasRutinasDeSocio.post('/', async (req, res) => {
  const { id } = esquemaParamId.parse(req.params);
  const datos = esquemaAsignarRutina.parse(req.body);
  res
    .status(201)
    .json(await asignarRutina(obtenerGimnasioId(req), id, obtenerAuth(req).usuarioId, datos));
});
