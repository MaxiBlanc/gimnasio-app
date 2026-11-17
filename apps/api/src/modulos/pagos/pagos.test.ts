import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { crearApp } from '../../app';
import { prisma } from '../../db';
import {
  fechaATexto,
  finDeMes,
  hoyEnArgentina,
  inicioDeMes,
  mesATexto,
  mesDeFecha,
  sumarMeses,
  type MesCalendario,
} from '../../dominio/periodos';
import { esViolacionDeExclusion, esViolacionDeUnicidad } from '../../erroresBase';
import { autorizacionDe, crearEscenarioBase, vaciarBase } from '../../test/datosDePrueba';

const app = crearApp();
let escenario: Awaited<ReturnType<typeof crearEscenarioBase>>;
let recepcionA: string;
let duenoA: string;
let socioId: string;
let planMensualId: string;

// Los tests se calculan relativos a HOY, igual que la API.
const mesActual = mesDeFecha(hoyEnArgentina());
const inicio = (m: MesCalendario) => fechaATexto(inicioDeMes(m));
const fin = (m: MesCalendario) => fechaATexto(finDeMes(m));

beforeEach(async () => {
  await vaciarBase();
  escenario = await crearEscenarioBase();
  recepcionA = autorizacionDe(escenario.gimnasioA.recepcion);
  duenoA = autorizacionDe(escenario.gimnasioA.dueno);

  const gimnasioId = escenario.gimnasioA.gimnasio.id;
  const plan = await prisma.plan.create({
    data: { gimnasioId, nombre: 'Mensual', precio: 30000, duracionMeses: 1 },
  });
  planMensualId = plan.id;
  const socio = await prisma.socio.create({
    data: {
      gimnasioId,
      nombre: 'Juan',
      apellido: 'Pérez',
      dni: '30111222',
      telefono: '1155551222',
      email: 'juan@mail.com',
      emergenciaNombre: 'Ana',
      emergenciaTelefono: '1144441222',
      planId: plan.id,
    },
  });
  socioId = socio.id;
});

const cobrar = (
  datos: object = { formaPago: 'EFECTIVO' },
  autorizacion = recepcionA,
  id = socioId,
) => request(app).post(`/api/socios/${id}/pagos`).set('Authorization', autorizacion).send(datos);

const anular = (pagoId: string, motivo = 'Se cargó dos veces', autorizacion = duenoA) =>
  request(app)
    .post(`/api/pagos/${pagoId}/anular`)
    .set('Authorization', autorizacion)
    .send({ motivo });

describe('Registro de pagos', () => {
  it('el primer pago cubre el mes actual completo, al precio del plan', async () => {
    const respuesta = await cobrar();

    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toMatchObject({
      periodoDesde: inicio(mesActual),
      periodoHasta: fin(mesActual),
      montoBase: 30000,
      montoDescuento: 0,
      montoFinal: 30000,
      formaPago: 'EFECTIVO',
      plan: { nombre: 'Mensual' },
      registradoPor: { nombre: 'recepcion Gimnasio A' },
      anulacion: null,
    });
  });

  it('el pago siguiente cubre el mes siguiente (pago adelantado)', async () => {
    await cobrar();
    const segundo = await cobrar({ formaPago: 'TRANSFERENCIA' });

    expect(segundo.status).toBe(201);
    expect(segundo.body.periodoDesde).toBe(inicio(sumarMeses(mesActual, 1)));
  });

  it('si pagó hace meses, cobra el mes actual sin cobrar los meses que no vino', async () => {
    await cobrar({ formaPago: 'EFECTIVO', desde: mesATexto(sumarMeses(mesActual, -4)) });
    const respuesta = await cobrar();
    expect(respuesta.body.periodoDesde).toBe(inicio(mesActual));
  });

  it('un plan trimestral cubre 3 meses', async () => {
    await prisma.plan.update({ where: { id: planMensualId }, data: { duracionMeses: 3 } });
    const respuesta = await cobrar();
    expect(respuesta.body.periodoHasta).toBe(fin(sumarMeses(mesActual, 2)));
  });

  it('aplica el descuento del socio y guarda su nombre', async () => {
    const descuento = await prisma.descuento.create({
      data: {
        gimnasioId: escenario.gimnasioA.gimnasio.id,
        nombre: 'Estudiante',
        tipo: 'PORCENTAJE',
        valor: 10,
      },
    });
    await prisma.socio.update({ where: { id: socioId }, data: { descuentoId: descuento.id } });

    const respuesta = await cobrar();
    expect(respuesta.body).toMatchObject({
      montoBase: 30000,
      montoDescuento: 3000,
      montoFinal: 27000,
      descuentoNombre: 'Estudiante',
    });
  });

  it('un descuento desactivado no se aplica', async () => {
    const descuento = await prisma.descuento.create({
      data: {
        gimnasioId: escenario.gimnasioA.gimnasio.id,
        nombre: 'Promo vieja',
        tipo: 'MONTO_FIJO',
        valor: 5000,
        activo: false,
      },
    });
    await prisma.socio.update({ where: { id: socioId }, data: { descuentoId: descuento.id } });

    expect((await cobrar()).body.montoFinal).toBe(30000);
  });

  it('el monto no lo decide el cliente: se ignora si lo mandan', async () => {
    const respuesta = await cobrar({ formaPago: 'EFECTIVO', montoFinal: 1 });
    expect(respuesta.body.montoFinal).toBe(30000);
  });

  it('cambiar el precio del plan no modifica los pagos ya registrados', async () => {
    const { body: pago } = await cobrar();
    await prisma.plan.update({ where: { id: planMensualId }, data: { precio: 99999 } });

    const historial = await request(app)
      .get(`/api/socios/${socioId}/pagos`)
      .set('Authorization', recepcionA);
    expect(historial.body[0]).toMatchObject({ id: pago.id, montoFinal: 30000 });
  });
});

describe('Reglas que impiden cobrar', () => {
  it('no se puede cobrar dos veces el mismo mes', async () => {
    await cobrar();
    const repetido = await cobrar({ formaPago: 'EFECTIVO', desde: mesATexto(mesActual) });

    expect(repetido.status).toBe(409);
    expect(repetido.body.error.codigo).toBe('PERIODO_YA_PAGO');
  });

  it('un trimestral no puede pisar un mes ya pagado más adelante', async () => {
    await cobrar({ formaPago: 'EFECTIVO', desde: mesATexto(sumarMeses(mesActual, 2)) });
    await prisma.plan.update({ where: { id: planMensualId }, data: { duracionMeses: 3 } });

    const respuesta = await cobrar({ formaPago: 'EFECTIVO', desde: mesATexto(mesActual) });
    expect(respuesta.status).toBe(409);
  });

  it('no se cobra a un socio dado de baja ni con un plan desactivado', async () => {
    await prisma.socio.update({ where: { id: socioId }, data: { activo: false } });
    expect((await cobrar()).body.error.codigo).toBe('SOCIO_DADO_DE_BAJA');

    await prisma.socio.update({ where: { id: socioId }, data: { activo: true } });
    await prisma.plan.update({ where: { id: planMensualId }, data: { activo: false } });
    expect((await cobrar()).body.error.codigo).toBe('PLAN_DESACTIVADO');
  });

  it('valida la forma de pago y el formato del mes', async () => {
    expect((await cobrar({ formaPago: 'BITCOIN' })).status).toBe(400);
    expect((await cobrar({ formaPago: 'EFECTIVO', desde: '2026-13' })).status).toBe(400);
  });
});

describe('Vista previa', () => {
  it('muestra lo mismo que se va a registrar, sin registrar nada', async () => {
    const vista = await request(app)
      .get(`/api/socios/${socioId}/pagos/vista-previa`)
      .set('Authorization', recepcionA);

    expect(vista.status).toBe(200);
    expect(vista.body).toMatchObject({
      periodoDesde: inicio(mesActual),
      montoFinal: 30000,
      plan: { nombre: 'Mensual', duracionMeses: 1 },
    });
    expect(await prisma.pago.count()).toBe(0);

    const pago = await cobrar();
    expect(pago.body.periodoDesde).toBe(vista.body.periodoDesde);
    expect(pago.body.montoFinal).toBe(vista.body.montoFinal);
  });
});

describe('Anulación', () => {
  it('el dueño anula con motivo, el pago queda registrado y el mes se libera', async () => {
    const { body: pago } = await cobrar();

    const respuesta = await anular(pago.id);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.anulacion).toMatchObject({
      motivo: 'Se cargó dos veces',
      por: { nombre: 'dueno Gimnasio A' },
    });

    // El mes vuelve a estar libre para el pago correcto.
    const nuevo = await cobrar();
    expect(nuevo.status).toBe(201);
    expect(nuevo.body.periodoDesde).toBe(inicio(mesActual));

    // El historial muestra los dos: el anulado no se borra.
    const historial = await request(app)
      .get(`/api/socios/${socioId}/pagos`)
      .set('Authorization', duenoA);
    expect(historial.body).toHaveLength(2);
  });

  it('recepción NO puede anular pagos', async () => {
    const { body: pago } = await cobrar();
    expect((await anular(pago.id, 'Me equivoqué', recepcionA)).status).toBe(403);
  });

  it('no se anula dos veces y el motivo es obligatorio', async () => {
    const { body: pago } = await cobrar();
    expect((await anular(pago.id, '')).status).toBe(400);
    await anular(pago.id);
    const otraVez = await anular(pago.id);
    expect(otraVez.status).toBe(409);
    expect(otraVez.body.error.codigo).toBe('PAGO_YA_ANULADO');
  });
});

describe('Permisos y aislamiento', () => {
  it.each(['profesor', 'kiosco'] as const)('el rol %s no ve ni registra pagos', async (rol) => {
    const autorizacion = autorizacionDe(escenario.gimnasioA[rol]);
    expect((await cobrar(undefined, autorizacion)).status).toBe(403);
    const historial = await request(app)
      .get(`/api/socios/${socioId}/pagos`)
      .set('Authorization', autorizacion);
    expect(historial.status).toBe(403);
  });

  it('otro gimnasio no puede cobrarle, ver sus pagos ni anularlos', async () => {
    const { body: pago } = await cobrar();
    const recepcionB = autorizacionDe(escenario.gimnasioB.recepcion);
    const duenoB = autorizacionDe(escenario.gimnasioB.dueno);

    expect((await cobrar(undefined, recepcionB)).status).toBe(404);
    const historial = await request(app)
      .get(`/api/socios/${socioId}/pagos`)
      .set('Authorization', recepcionB);
    expect(historial.status).toBe(404);
    expect((await anular(pago.id, 'Intento ajeno', duenoB)).status).toBe(404);
    expect(await prisma.pago.count({ where: { anuladoEn: { not: null } } })).toBe(0);
  });
});

describe('Errores de la base', () => {
  // Si dos personas cobran a la vez, las dos pasan el chequeo de la API y la base frena a una.
  // Verificamos que reconocemos ese error para responder 409 en vez de 500.
  it('reconoce la violación de la restricción EXCLUDE (pagos superpuestos)', async () => {
    const { body: pago } = await cobrar();
    const existente = await prisma.pago.findUniqueOrThrow({ where: { id: pago.id } });
    const { id: _id, creadoEn: _creadoEn, ...copia } = existente;

    const error = await prisma.pago.create({ data: copia }).catch((e: unknown) => e);
    expect(esViolacionDeExclusion(error)).toBe(true);
  });

  it('reconoce la violación de una restricción UNIQUE (dato duplicado)', async () => {
    const error = await prisma.gimnasio
      .create({ data: { nombre: 'Copia', slug: 'gimnasio-a' } })
      .catch((e: unknown) => e);
    expect(esViolacionDeUnicidad(error)).toBe(true);
  });
});
