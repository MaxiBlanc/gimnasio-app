import { Router } from 'express';
import { esquemaCrearGimnasio, esquemaEditarGimnasio } from '@gimnasio/compartido';
import { autenticar, permitirRoles } from '../../middlewares/autenticar';
import { esquemaParamId } from '../../validacion';
import {
  crearGimnasio,
  editarGimnasio,
  listarGimnasios,
  obtenerGimnasio,
} from './gimnasios.servicio';

export const rutasAdmin = Router();

// Todas las rutas de este router exigen estar logueado como súper-admin.
// Al ponerlo con `use` al principio, no hay forma de olvidárselo en una ruta nueva.
rutasAdmin.use(autenticar, permitirRoles('SUPERADMIN'));

rutasAdmin.get('/gimnasios', async (_req, res) => {
  res.json(await listarGimnasios());
});

rutasAdmin.get('/gimnasios/:id', async (req, res) => {
  const { id } = esquemaParamId.parse(req.params);
  res.json(await obtenerGimnasio(id));
});

rutasAdmin.post('/gimnasios', async (req, res) => {
  const datos = esquemaCrearGimnasio.parse(req.body);
  res.status(201).json(await crearGimnasio(datos)); // 201 Created
});

rutasAdmin.patch('/gimnasios/:id', async (req, res) => {
  const { id } = esquemaParamId.parse(req.params);
  const datos = esquemaEditarGimnasio.parse(req.body);
  res.json(await editarGimnasio(id, datos));
});
