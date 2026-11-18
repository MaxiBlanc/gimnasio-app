import { Router } from 'express';
import { esquemaCrearPersonal, esquemaEditarPersonal } from '@gimnasio/compartido';
import { autenticar, obtenerGimnasioId, permitirRoles } from '../../middlewares/autenticar';
import { esquemaParamId } from '../../validacion';
import { crearPersonal, editarPersonal, listarPersonal } from './personal.servicio';

/** Personal del gimnasio (recepción, profes, pantalla de ingreso): lo maneja solo el dueño. */
export const rutasPersonal = Router();

rutasPersonal.use(autenticar, permitirRoles('DUENO'));

rutasPersonal.get('/', async (req, res) => {
  res.json(await listarPersonal(obtenerGimnasioId(req)));
});

rutasPersonal.post('/', async (req, res) => {
  const datos = esquemaCrearPersonal.parse(req.body);
  res.status(201).json(await crearPersonal(obtenerGimnasioId(req), datos));
});

rutasPersonal.put('/:id', async (req, res) => {
  const { id } = esquemaParamId.parse(req.params);
  const datos = esquemaEditarPersonal.parse(req.body);
  res.json(await editarPersonal(obtenerGimnasioId(req), id, datos));
});
