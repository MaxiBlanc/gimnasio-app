import type { Correo } from './correo';

/**
 * Escapa caracteres especiales de HTML. Los nombres los escribe un usuario: si alguien
 * carga como nombre "<script>...", sin escapar se inyectaría HTML en el mail.
 */
export function escaparHtml(texto: string): string {
  return texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

interface DatosGimnasioCorreo {
  nombre: string;
  colorPrimario: string;
  colorSecundario: string;
}

/** Estructura común de todos los mails: encabezado con los colores del gimnasio. */
function maquetar(gimnasio: DatosGimnasioCorreo, contenido: string): string {
  const nombre = escaparHtml(gimnasio.nombre);
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0">
      <tr><td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden">
          <tr><td style="background:${gimnasio.colorSecundario};padding:20px 32px;font-size:20px;font-weight:bold;color:${gimnasio.colorPrimario}">${nombre}</td></tr>
          <tr><td style="padding:32px;font-size:16px;line-height:1.5">${contenido}</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function correoActivacion(datos: {
  para: string;
  nombreSocio: string;
  gimnasio: DatosGimnasioCorreo;
  enlace: string;
  diasValidez: number;
}): Correo {
  const { gimnasio, enlace, diasValidez } = datos;
  const nombre = escaparHtml(datos.nombreSocio);
  return {
    para: datos.para,
    asunto: `Activá tu cuenta de ${gimnasio.nombre}`,
    html: maquetar(
      gimnasio,
      `<p>¡Hola, ${nombre}!</p>
       <p>Ya sos socio/a de <strong>${escaparHtml(gimnasio.nombre)}</strong>. Creá tu contraseña para ver tu cuota, tus rutinas y cuánta gente hay en el gimnasio.</p>
       <p style="text-align:center;margin:32px 0">
         <a href="${enlace}" style="background:${gimnasio.colorPrimario};color:${gimnasio.colorSecundario};padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold">Crear mi contraseña</a>
       </p>
       <p style="font-size:13px;color:#71717a">El enlace vence en ${diasValidez} días. Si no esperabas este mail, ignoralo.</p>`,
    ),
    texto:
      `¡Hola, ${datos.nombreSocio}!\n\n` +
      `Ya sos socio/a de ${gimnasio.nombre}. Creá tu contraseña entrando a:\n${enlace}\n\n` +
      `El enlace vence en ${diasValidez} días.`,
  };
}

/** Botón grande con los colores del gimnasio (lo usan varios mails). */
function boton(gimnasio: DatosGimnasioCorreo, enlace: string, texto: string): string {
  return `<p style="text-align:center;margin:32px 0">
         <a href="${enlace}" style="background:${gimnasio.colorPrimario};color:${gimnasio.colorSecundario};padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold">${texto}</a>
       </p>`;
}

interface DatosAvisoCuota {
  para: string;
  nombreSocio: string;
  gimnasio: DatosGimnasioCorreo;
  /** Mes de la cuota, ya escrito para leer: "diciembre de 2026". */
  mes: string;
  /** Link a "mi cuenta" del socio. */
  enlace: string;
}

/** Aviso automático: faltan pocos días para fin de mes y no pagó el que viene. */
export function correoCuotaPorVencer(datos: DatosAvisoCuota): Correo {
  const { gimnasio, mes, enlace } = datos;
  const nombre = escaparHtml(datos.nombreSocio);
  return {
    para: datos.para,
    asunto: `Tu cuota de ${mes} está por vencer`,
    html: maquetar(
      gimnasio,
      `<p>¡Hola, ${nombre}!</p>
       <p>Te recordamos que se acerca la cuota de <strong>${escaparHtml(mes)}</strong> en ${escaparHtml(gimnasio.nombre)}. Podés pagarla en recepción.</p>
       ${boton(gimnasio, enlace, 'Ver mi cuota')}
       <p style="font-size:13px;color:#71717a">Si ya la pagaste, ignorá este mail.</p>`,
    ),
    texto:
      `¡Hola, ${datos.nombreSocio}!\n\n` +
      `Te recordamos que se acerca la cuota de ${mes} en ${gimnasio.nombre}. ` +
      `Podés pagarla en recepción.\n\nVer mi cuota: ${enlace}`,
  };
}

/** Aviso automático: pasó el día de cierre y la cuota del mes sigue sin pagar. */
export function correoCuotaVencida(datos: DatosAvisoCuota): Correo {
  const { gimnasio, mes, enlace } = datos;
  const nombre = escaparHtml(datos.nombreSocio);
  return {
    para: datos.para,
    asunto: `Tu cuota de ${mes} está vencida`,
    html: maquetar(
      gimnasio,
      `<p>¡Hola, ${nombre}!</p>
       <p>La cuota de <strong>${escaparHtml(mes)}</strong> en ${escaparHtml(gimnasio.nombre)} figura como <strong>vencida</strong>. Acercate a recepción para ponerte al día.</p>
       ${boton(gimnasio, enlace, 'Ver mi cuota')}
       <p style="font-size:13px;color:#71717a">Si ya la pagaste, ignorá este mail.</p>`,
    ),
    texto:
      `¡Hola, ${datos.nombreSocio}!\n\n` +
      `La cuota de ${mes} en ${gimnasio.nombre} figura como vencida. ` +
      `Acercate a recepción para ponerte al día.\n\nVer mi cuota: ${enlace}`,
  };
}
