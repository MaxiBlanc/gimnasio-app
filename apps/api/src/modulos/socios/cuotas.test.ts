import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { ESTADOS_CUOTA, type EstadoCuota, type Socio } from '@gimnasio/compartido';
import { crearApp } from '../../app';
import { prisma } from '../../db';
import { calcularEstadoCuota } from '../../dominio/estadoCuota';
import {
  hoyEnArgentina,
  mesDeFecha,
  periodoDePago,
  sumarMeses,
  type MesCalendario,
} from '../../dominio/periodos';
import { autorizacionDe, crearEscenarioBase, vaciarBase } from '../../test/datosDePrueba';

/**
 * Estos tests corren con la fecha REAL de hoy, así que no sabemos de antemano si hoy es
 * día 3 o día 28. Por eso no esperamos estados fijos: comparamos la API contra la función
 * pura (que ya tiene sus propios tests con fechas fijas) y probamos varias configuraciones
 * para recorrer todas las ramas.
 */

const app = crearApp();
let escenario: Awaited<ReturnType<typeof crearEscenarioBase>>;
let recepcionA: string;
const mesActual = mesDeFecha(hoyEnArgentina());

beforeEach(async () => {
  await vaciarBase();
  escenario = await crearEscenarioBase();
  recepcionA = autorizacionDe(escenario.gimnasioA.recepcion);

  const gimnasioId = escenario.gimnasioA.gimnasio.id;
  const plan = await prisma.plan.create({
    data: { gimnasioId, nombre: 'Mensual', precio: 30000, duracionMeses: 1 },
  });
  const usuarioId = escenario.gimnasioA.recepcion.id;

  // Un socio por situación: [apellido, meses pagados (relativos al actual), pagos anulados]
  const casos: [string, number[], number[]][] = [
    ['PagoEsteMes', [0], []],
    ['PagoElSiguiente', [0, 1], []],
    ['DebeEsteMes', [-1], []],
    ['DebeVariosMeses', [-4], []],
    ['NuncaPago', [], []],
    ['SoloPagoAnulado', [], [0]], // un pago anulado NO cuenta
  ];
  for (const [apellido, pagados, anulados] of casos) {
    const socio = await prisma.socio.create({
      data: {
        gimnasioId,
        nombre: 'Socio',
        apellido,
        dni: String(20000000 + casos.findIndex(([nombre]) => nombre === apellido)),
        telefono: '1155551222',
        email: `${apellido}@mail.com`,
        emergenciaNombre: 'Ana',
        emergenciaTelefono: '1144441222',
        planId: plan.id,
      },
    });
    const pagar = (desplazamiento: number, anulado: boolean) =>
      prisma.pago.create({
        data: {
          gimnasioId,
          socioId: socio.id,
          planId: plan.id,
          ...periodoDePago(sumarMeses(mesActual, desplazamiento) as MesCalendario, 1),
          montoBase: 30000,
          montoFinal: 30000,
          formaPago: 'EFECTIVO',
          registradoPorId: usuarioId,
          ...(anulado
            ? { anuladoEn: new Date(), anuladoPorId: usuarioId, motivoAnulacion: 'Prueba' }
            : {}),
        },
      });
    for (const d of pagados) await pagar(d, false);
    for (const d of anulados) await pagar(d, true);
  }
});

const listar = async (consulta = ''): Promise<Socio[]> =>
  (await request(app).get(`/api/socios?porPagina=100${consulta}`).set('Authorization', recepcionA))
    .body.datos;

/** Estado esperado según la función pura, con la config actual del gimnasio. */
async function estadoEsperado(socio: Socio): Promise<EstadoCuota> {
  const config = await prisma.gimnasio.findUniqueOrThrow({
    where: { id: escenario.gimnasioA.gimnasio.id },
  });
  const vencimiento = socio.cuota.vencimiento
    ? new Date(`${socio.cuota.vencimiento}T00:00:00Z`)
    : null;
  return calcularEstadoCuota(vencimiento, hoyEnArgentina(), config);
}

describe('Estado de cuota en el listado', () => {
  it('informa el vencimiento: el último día pagado, ignorando pagos anulados', async () => {
    const socios = await listar();
    const vencimiento = (apellido: string) =>
      socios.find((s) => s.apellido === apellido)!.cuota.vencimiento;

    expect(vencimiento('NuncaPago')).toBeNull();
    expect(vencimiento('SoloPagoAnulado')).toBeNull();
    expect(vencimiento('PagoElSiguiente')! > vencimiento('PagoEsteMes')!).toBe(true);
  });

  it('el que pagó el mes siguiente siempre está AL_DIA y el que debe nunca lo está', async () => {
    const socios = await listar();
    const estado = (apellido: string) => socios.find((s) => s.apellido === apellido)!.cuota.estado;

    expect(estado('PagoElSiguiente')).toBe('AL_DIA');
    expect(['PENDIENTE', 'VENCIDO']).toContain(estado('DebeVariosMeses'));
    expect(['PENDIENTE', 'VENCIDO']).toContain(estado('NuncaPago'));
  });

  // Distintas configuraciones para pasar por todas las ramas de las reglas, sea el día que sea.
  it.each([
    { diaCierreCobro: 10, diasAvisoVencimiento: 5 },
    { diaCierreCobro: 1, diasAvisoVencimiento: 0 },
    { diaCierreCobro: 28, diasAvisoVencimiento: 28 },
  ])('el estado, el filtro y el resumen coinciden con la regla (config %o)', async (config) => {
    await prisma.gimnasio.update({ where: { id: escenario.gimnasioA.gimnasio.id }, data: config });
    const socios = await listar();

    // 1) Cada socio tiene el estado que dice la función pura.
    for (const socio of socios) {
      expect(socio.cuota.estado, socio.apellido).toBe(await estadoEsperado(socio));
    }

    // 2) Filtrar por un estado (hecho en SQL) trae exactamente esos socios.
    const resumen = (
      await request(app).get('/api/socios/resumen-cuotas').set('Authorization', recepcionA)
    ).body;
    for (const estado of ESTADOS_CUOTA) {
      const esperados = socios
        .filter((s) => s.cuota.estado === estado)
        .map((s) => s.apellido)
        .sort();
      const filtrados = (await listar(`&estado=${estado}`)).map((s) => s.apellido).sort();
      expect(filtrados, `filtro ${estado}`).toEqual(esperados);
      // 3) El resumen cuenta lo mismo.
      expect(resumen[estado], `resumen ${estado}`).toBe(esperados.length);
    }
  });

  it('el resumen no cuenta socios dados de baja', async () => {
    await prisma.socio.updateMany({ where: { apellido: 'NuncaPago' }, data: { activo: false } });
    const resumen = (
      await request(app).get('/api/socios/resumen-cuotas').set('Authorization', recepcionA)
    ).body;
    const total = ESTADOS_CUOTA.reduce((suma, estado) => suma + resumen[estado], 0);
    expect(total).toBe(5);
  });

  it('rechaza un estado inexistente en el filtro', async () => {
    const respuesta = await request(app)
      .get('/api/socios?estado=MOROSO')
      .set('Authorization', recepcionA);
    expect(respuesta.status).toBe(400);
  });

  it('el profesor no ve el resumen de cuotas', async () => {
    const respuesta = await request(app)
      .get('/api/socios/resumen-cuotas')
      .set('Authorization', autorizacionDe(escenario.gimnasioA.profesor));
    expect(respuesta.status).toBe(403);
  });
});
