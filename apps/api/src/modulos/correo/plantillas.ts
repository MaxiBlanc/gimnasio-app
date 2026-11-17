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
