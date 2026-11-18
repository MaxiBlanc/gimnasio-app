import { Router } from 'express';
import { esquemaCrearClase, esquemaEditarClase } from '@gimnasio/compartido';
import { autenticar, obtenerGimnasioId, permitirRoles } from '../../middlewares/autenticar';
import { esquemaParamId } from '../../validacion';
import {
  agendaDelPersonal,
  crearClase,
  editarClase,
  listarClases,
  listarProfesores,
} from './clases.servicio';

export const rutasClases = Router();
rutasClases.use(autenticar);

// Ver: todo el personal que atiende (la tablet no).
const veClases = permitirRoles('DUENO', 'RECEPCION', 'PROFESOR');

rutasClases.get('/', veClases, async (req, res) => {
  res.json(await listarClases(obtenerGimnasioId(req)));
});

rutasClases.get('/agenda', veClases, async (req, res) => {
  res.json(await agendaDelPersonal(obtenerGimnasioId(req)));
});

// Armar el cronograma: solo el dueño.
rutasClases.get('/profesores', permitirRoles('DUENO'), async (req, res) => {
  res.json(await listarProfesores(obtenerGimnasioId(req)));
});

rutasClases.post('/', permitirRoles('DUENO'), async (req, res) => {
  const datos = esquemaCrearClase.parse(req.body);
  res.status(201).json(await crearClase(obtenerGimnasioId(req), datos));
});

rutasClases.patch('/:id', permitirRoles('DUENO'), async (req, res) => {
  const { id } = esquemaParamId.parse(req.params);
  const datos = esquemaEditarClase.parse(req.body);
  res.json(await editarClase(obtenerGimnasioId(req), id, datos));
});
