import { entorno } from '../../config/entorno';
import { prisma } from '../../db';
import { limitesDeHoy } from '../../dominio/estadoCuota';
import {
  hoyEnArgentina,
  inicioDeMes,
  mesATexto,
  mesDeFecha,
  sumarMeses,
} from '../../dominio/periodos';
import { TipoAviso } from '../../generated/prisma/enums';
import { enviarCorreo } from '../correo/correo';
import { correoCuotaPorVencer, correoCuotaVencida } from '../correo/plantillas';
import { filtroEstado } from '../socios/socios.servicio';

/**
 * Tope de mails por corrida. La función de Vercel tiene 30 segundos como máximo:
 * si quedan más, salen al día siguiente (el registro de avisos evita repetir).
 */
const MAXIMO_POR_CORRIDA = 150;

export interface ResultadoAvisos {
  enviados: number;
  fallidos: number;
}

const nombreDelMes = (fecha: Date) =>
  new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    fecha,
  );

/**
 * Lo corre el cron de Vercel una vez por día. Para cada gimnasio activo:
 * - En los últimos días del mes: avisa "por vencer" a quien pagó este mes pero no el que viene.
 * - Pasado el día de cierre: avisa "vencida" a quien no pagó este mes.
 *
 * Cada aviso se manda UNA sola vez por socio, tipo y mes (tabla avisos_enviados).
 * Si el mail falla, no se anota: se reintenta en la próxima corrida.
 */
export async function enviarAvisosDeCuota(ahora = new Date()): Promise<ResultadoAvisos> {
  const hoy = hoyEnArgentina(ahora);
  const mesActual = mesDeFecha(hoy);
  const resultado: ResultadoAvisos = { enviados: 0, fallidos: 0 };

  const gimnasios = await prisma.gimnasio.findMany({
    where: { activo: true },
    select: {
      id: true,
      nombre: true,
      slug: true,
      colorPrimario: true,
      colorSecundario: true,
      diaCierreCobro: true,
      diasAvisoVencimiento: true,
    },
  });

  for (const gimnasio of gimnasios) {
    const contexto = { hoy, config: gimnasio };
    const { enPeriodoDeAviso, pasoElCierre } = limitesDeHoy(hoy, gimnasio);

    // Qué avisos tocan hoy en este gimnasio, y de qué mes es la cuota de cada uno.
    const avisos = [
      ...(enPeriodoDeAviso
        ? [
            {
              tipo: TipoAviso.POR_VENCER,
              estado: 'POR_VENCER',
              mes: sumarMeses(mesActual, 1),
            } as const,
          ]
        : []),
      ...(pasoElCierre
        ? [{ tipo: TipoAviso.VENCIDO, estado: 'VENCIDO', mes: mesActual } as const]
        : []),
    ];

    for (const aviso of avisos) {
      const mes = mesATexto(aviso.mes);
      const socios = await prisma.socio.findMany({
        where: {
          gimnasioId: gimnasio.id,
          activo: true,
          ...filtroEstado(aviso.estado, contexto),
          // Los que ya recibieron este aviso, no.
          avisos: { none: { tipo: aviso.tipo, mes } },
        },
        select: { id: true, nombre: true, email: true },
        take: MAXIMO_POR_CORRIDA - resultado.enviados,
      });

      const plantilla =
        aviso.tipo === TipoAviso.VENCIDO ? correoCuotaVencida : correoCuotaPorVencer;
      for (const socio of socios) {
        try {
          await enviarCorreo(
            plantilla({
              para: socio.email,
              nombreSocio: socio.nombre,
              gimnasio,
              mes: nombreDelMes(inicioDeMes(aviso.mes)),
              enlace: `${entorno.ORIGEN_WEB}/g/${gimnasio.slug}/socio`,
            }),
          );
          await prisma.avisoEnviado.create({
            data: { gimnasioId: gimnasio.id, socioId: socio.id, tipo: aviso.tipo, mes },
          });
          resultado.enviados++;
        } catch (error) {
          console.error(`No se pudo avisar al socio ${socio.id}:`, error);
          resultado.fallidos++;
        }
      }
      if (resultado.enviados >= MAXIMO_POR_CORRIDA) return resultado;
    }
  }
  return resultado;
}
