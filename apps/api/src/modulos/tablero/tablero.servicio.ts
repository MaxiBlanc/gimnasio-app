import type { Tablero } from '@gimnasio/compartido';
import { prisma } from '../../db';
import {
  ZONA_HORARIA,
  fechaATexto,
  hoyEnArgentina,
  inicioDeMes,
  mesDeFecha,
  sumarMeses,
} from '../../dominio/periodos';

const DIA_MS = 24 * 60 * 60 * 1000;
/** Argentina está en UTC-3 todo el año: las 00:00 de allá son las 03:00 UTC. */
const DESFASE_ARGENTINA_MS = 3 * 60 * 60 * 1000;
const DIAS_GRAFICO = 14;
const SEMANAS_PROMEDIO = 4;

/** Convierte una fecha "de calendario" (00:00 UTC) al instante en que empieza ese día en Argentina. */
const empiezaEnArgentina = (fecha: Date) => new Date(fecha.getTime() + DESFASE_ARGENTINA_MS);

async function cobradoEntre(gimnasioId: string, desde: Date, hasta: Date): Promise<number> {
  const { _sum } = await prisma.pago.aggregate({
    where: { gimnasioId, anuladoEn: null, creadoEn: { gte: desde, lt: hasta } },
    _sum: { montoFinal: true },
  });
  return _sum.montoFinal?.toNumber() ?? 0;
}

/**
 * Números para el dueño. Las agrupaciones por día y por hora se hacen en SQL con la zona
 * horaria de Argentina: si agrupáramos en UTC, quien entra a las 22 h contaría para el día siguiente.
 */
export async function obtenerTablero(gimnasioId: string, ahora = new Date()): Promise<Tablero> {
  const hoy = hoyEnArgentina(ahora);
  const mes = mesDeFecha(hoy);
  const inicioMes = empiezaEnArgentina(inicioDeMes(mes));
  const inicioMesAnterior = empiezaEnArgentina(inicioDeMes(sumarMeses(mes, -1)));
  const inicioHoy = empiezaEnArgentina(hoy);
  const inicioGrafico = new Date(inicioHoy.getTime() - (DIAS_GRAFICO - 1) * DIA_MS);
  const inicioPromedio = new Date(inicioHoy.getTime() - SEMANAS_PROMEDIO * 7 * DIA_MS);

  const [mesActual, mesAnterior, sociosActivos, altasDelMes, ingresosHoy, ultimos7Dias] =
    await Promise.all([
      cobradoEntre(gimnasioId, inicioMes, empiezaEnArgentina(inicioDeMes(sumarMeses(mes, 1)))),
      cobradoEntre(gimnasioId, inicioMesAnterior, inicioMes),
      prisma.socio.count({ where: { gimnasioId, activo: true } }),
      prisma.socio.count({ where: { gimnasioId, creadoEn: { gte: inicioMes } } }),
      prisma.ingreso.count({ where: { gimnasioId, creadoEn: { gte: inicioHoy } } }),
      prisma.ingreso.count({
        where: { gimnasioId, creadoEn: { gte: new Date(inicioHoy.getTime() - 6 * DIA_MS) } },
      }),
    ]);

  // $queryRaw con template string: los valores van como parámetros (sin riesgo de inyección SQL).
  // COUNT devuelve bigint en Postgres; lo pasamos a number (son cantidades chicas).
  const porDia = await prisma.$queryRaw<{ fecha: Date; cantidad: bigint }[]>`
    SELECT (creado_en AT TIME ZONE ${ZONA_HORARIA})::date AS fecha, COUNT(*) AS cantidad
    FROM ingresos
    WHERE gimnasio_id = ${gimnasioId}::uuid AND creado_en >= ${inicioGrafico}
    GROUP BY 1`;
  const porHora = await prisma.$queryRaw<{ hora: number; cantidad: bigint }[]>`
    SELECT EXTRACT(HOUR FROM creado_en AT TIME ZONE ${ZONA_HORARIA})::int AS hora, COUNT(*) AS cantidad
    FROM ingresos
    WHERE gimnasio_id = ${gimnasioId}::uuid AND creado_en >= ${inicioPromedio} AND creado_en < ${inicioHoy}
    GROUP BY 1`;

  // Completamos los días y horas sin entradas con 0, así el gráfico no tiene huecos.
  const cantidadPorFecha = new Map(porDia.map((f) => [fechaATexto(f.fecha), Number(f.cantidad)]));
  const ingresosPorDia = Array.from({ length: DIAS_GRAFICO }, (_, i) => {
    const fecha = fechaATexto(new Date(hoy.getTime() - (DIAS_GRAFICO - 1 - i) * DIA_MS));
    return { fecha, cantidad: cantidadPorFecha.get(fecha) ?? 0 };
  });
  const cantidadPorHora = new Map(porHora.map((f) => [f.hora, Number(f.cantidad)]));
  const diasPromedio = SEMANAS_PROMEDIO * 7;
  const ingresosPorHora = Array.from({ length: 24 }, (_, hora) => ({
    hora,
    // Con dos decimales: en un gimnasio chico, una entrada cada 4 semanas da 0,04.
    promedio: Math.round(((cantidadPorHora.get(hora) ?? 0) / diasPromedio) * 100) / 100,
  }));

  return {
    cobrado: { mesActual, mesAnterior },
    sociosActivos,
    altasDelMes,
    ingresos: { hoy: ingresosHoy, ultimos7Dias },
    ingresosPorDia,
    ingresosPorHora,
  };
}
