import { Router } from 'express';
import { esquemaCrearPlan, esquemaEditarPlan } from '@gimnasio/compartido';
import { autenticar, obtenerGimnasioId, permitirRoles } from '../../middlewares/autenticar';
import { esquemaParamId } from '../../validacion';
import { crearPlan, editarPlan, listarPlanes } from './planes.servicio';

export const rutasPlanes = Router();

rutasPlanes.use(autenticar);

// Consultar: dueño y recepción (recepción elige el plan al dar de alta un socio o cobrar).
rutasPlanes.get('/', permitirRoles('DUENO', 'RECEPCION'), async (req, res) => {
  res.json(await listarPlanes(obtenerGimnasioId(req)));
});

// Modificar: solo el dueño (es configuración del gimnasio).
rutasPlanes.post('/', permitirRoles('DUENO'), async (req, res) => {
  const datos = esquemaCrearPlan.parse(req.body);
  res.status(201).json(await crearPlan(obtenerGimnasioId(req), datos));
});

rutasPlanes.patch('/:id', permitirRoles('DUENO'), async (req, res) => {
  const { id } = esquemaParamId.parse(req.params);
  const datos = esquemaEditarPlan.parse(req.body);
  res.json(await editarPlan(obtenerGimnasioId(req), id, datos));
});
