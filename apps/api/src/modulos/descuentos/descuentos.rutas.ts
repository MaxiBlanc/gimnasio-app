import { Router } from 'express';
import { esquemaCrearDescuento, esquemaEditarDescuento } from '@gimnasio/compartido';
import { autenticar, obtenerGimnasioId, permitirRoles } from '../../middlewares/autenticar';
import { esquemaParamId } from '../../validacion';
import { crearDescuento, editarDescuento, listarDescuentos } from './descuentos.servicio';

export const rutasDescuentos = Router();

rutasDescuentos.use(autenticar);

rutasDescuentos.get('/', permitirRoles('DUENO', 'RECEPCION'), async (req, res) => {
  res.json(await listarDescuentos(obtenerGimnasioId(req)));
});

rutasDescuentos.post('/', permitirRoles('DUENO'), async (req, res) => {
  const datos = esquemaCrearDescuento.parse(req.body);
  res.status(201).json(await crearDescuento(obtenerGimnasioId(req), datos));
});

rutasDescuentos.patch('/:id', permitirRoles('DUENO'), async (req, res) => {
  const { id } = esquemaParamId.parse(req.params);
  const datos = esquemaEditarDescuento.parse(req.body);
  res.json(await editarDescuento(obtenerGimnasioId(req), id, datos));
});
