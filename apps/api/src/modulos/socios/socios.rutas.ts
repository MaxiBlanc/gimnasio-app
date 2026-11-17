import { Router } from 'express';
import {
  esquemaActivarCuenta,
  esquemaCrearSocio,
  esquemaEditarSocio,
  esquemaFiltrosSocios,
} from '@gimnasio/compartido';
import { autenticar, obtenerGimnasioId, permitirRoles } from '../../middlewares/autenticar';
import { esquemaParamId } from '../../validacion';
import { activarCuenta, reenviarActivacion } from './activacion.servicio';
import {
  crearSocio,
  editarSocio,
  listarSocios,
  obtenerSocio,
  resumenCuotas,
} from './socios.servicio';

// ───────────────────── Gestión de socios (personal del gimnasio) ─────────────────────

export const rutasSocios = Router();

rutasSocios.use(autenticar);

// Ver socios: dueño, recepción y profesor (el profe necesita verlos para asignarles rutinas).
const puedenVer = permitirRoles('DUENO', 'RECEPCION', 'PROFESOR');
// Cargar y modificar socios: dueño y recepción.
const puedenEditar = permitirRoles('DUENO', 'RECEPCION');

rutasSocios.get('/', puedenVer, async (req, res) => {
  const filtros = esquemaFiltrosSocios.parse(req.query);
  res.json(await listarSocios(obtenerGimnasioId(req), filtros));
});

// Va ANTES de '/:id': Express prueba las rutas en orden, y si no, tomaría
// "resumen-cuotas" como si fuera el id de un socio.
rutasSocios.get('/resumen-cuotas', puedenEditar, async (req, res) => {
  res.json(await resumenCuotas(obtenerGimnasioId(req)));
});

rutasSocios.get('/:id', puedenVer, async (req, res) => {
  const { id } = esquemaParamId.parse(req.params);
  res.json(await obtenerSocio(obtenerGimnasioId(req), id));
});

rutasSocios.post('/', puedenEditar, async (req, res) => {
  const datos = esquemaCrearSocio.parse(req.body);
  res.status(201).json(await crearSocio(obtenerGimnasioId(req), datos));
});

rutasSocios.patch('/:id', puedenEditar, async (req, res) => {
  const { id } = esquemaParamId.parse(req.params);
  const datos = esquemaEditarSocio.parse(req.body);
  res.json(await editarSocio(obtenerGimnasioId(req), id, datos));
});

rutasSocios.post('/:id/reenviar-activacion', puedenEditar, async (req, res) => {
  const { id } = esquemaParamId.parse(req.params);
  res.json({ correoEnviado: await reenviarActivacion(obtenerGimnasioId(req), id) });
});

// ───────────────────── Cuenta del socio (pública: sin login) ─────────────────────

export const rutasCuentaSocio = Router();

rutasCuentaSocio.post('/activar', async (req, res) => {
  const datos = esquemaActivarCuenta.parse(req.body);
  res.json(await activarCuenta(datos));
});
