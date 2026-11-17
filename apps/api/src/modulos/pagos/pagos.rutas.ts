import { Router } from 'express';
import {
  esquemaAnularPago,
  esquemaRegistrarPago,
  esquemaVistaPreviaPago,
} from '@gimnasio/compartido';
import {
  autenticar,
  obtenerAuth,
  obtenerGimnasioId,
  permitirRoles,
} from '../../middlewares/autenticar';
import { esquemaParamId } from '../../validacion';
import { anularPago, listarPagosDeSocio, registrarPago, vistaPreviaPago } from './pagos.servicio';

// ───────────── Pagos de un socio: /api/socios/:id/pagos ─────────────

// mergeParams: este router se monta en una ruta con :id, y así puede leer ese :id.
export const rutasPagosDeSocio = Router({ mergeParams: true });

rutasPagosDeSocio.use(autenticar, permitirRoles('DUENO', 'RECEPCION'));

rutasPagosDeSocio.get('/', async (req, res) => {
  const { id } = esquemaParamId.parse(req.params);
  res.json(await listarPagosDeSocio(obtenerGimnasioId(req), id));
});

/** Cuánto y qué meses se cobrarían, sin registrar nada. ?desde=AAAA-MM es opcional. */
rutasPagosDeSocio.get('/vista-previa', async (req, res) => {
  const { id } = esquemaParamId.parse(req.params);
  const { desde } = esquemaVistaPreviaPago.parse(req.query);
  res.json(await vistaPreviaPago(obtenerGimnasioId(req), id, desde));
});

rutasPagosDeSocio.post('/', async (req, res) => {
  const { id } = esquemaParamId.parse(req.params);
  const datos = esquemaRegistrarPago.parse(req.body);
  const pago = await registrarPago(obtenerGimnasioId(req), id, obtenerAuth(req).usuarioId, datos);
  res.status(201).json(pago);
});

// ───────────── Operaciones sobre un pago: /api/pagos/:id ─────────────

export const rutasPagos = Router();

rutasPagos.use(autenticar);

// Anular: SOLO el dueño. Si recepción pudiera anular, alguien podría cobrar en efectivo
// y después anular el pago. Así, toda anulación pasa por el dueño y queda registrada.
rutasPagos.post('/:id/anular', permitirRoles('DUENO'), async (req, res) => {
  const { id } = esquemaParamId.parse(req.params);
  const datos = esquemaAnularPago.parse(req.body);
  res.json(await anularPago(obtenerGimnasioId(req), id, obtenerAuth(req).usuarioId, datos));
});
