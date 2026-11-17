import nodemailer, { type Transporter } from 'nodemailer';
import { entorno } from '../../config/entorno';

export interface Correo {
  para: string;
  asunto: string;
  html: string;
  /** Versión en texto plano: la usan algunos clientes de correo y mejora la entregabilidad. */
  texto: string;
}

/**
 * Bandeja en memoria para los tests (CORREO_MODO=memoria): en vez de mandar, guarda.
 * `fallar` permite simular que el servidor de correo está caído.
 */
export const bandejaDePrueba = {
  correos: [] as Correo[],
  fallar: false,
  vaciar() {
    this.correos = [];
    this.fallar = false;
  },
};

let transporte: Transporter | null = null;

/** Crea la conexión SMTP una sola vez y la reutiliza ("lazy singleton"). */
function obtenerTransporte(): Transporter {
  transporte ??= nodemailer.createTransport({
    host: entorno.SMTP_HOST,
    port: entorno.SMTP_PUERTO,
    secure: entorno.SMTP_PUERTO === 465, // 465 = SMTP con TLS desde el principio
    auth: entorno.SMTP_USUARIO
      ? { user: entorno.SMTP_USUARIO, pass: entorno.SMTP_CONTRASENA }
      : undefined,
  });
  return transporte;
}

/**
 * Único punto de salida de mails de la app. Para cambiar de proveedor (Mailpit → Resend)
 * alcanza con cambiar variables de entorno: el resto del código no se entera.
 */
export async function enviarCorreo(correo: Correo): Promise<void> {
  if (entorno.CORREO_MODO === 'memoria') {
    if (bandejaDePrueba.fallar) throw new Error('Fallo de correo simulado');
    bandejaDePrueba.correos.push(correo);
    return;
  }

  await obtenerTransporte().sendMail({
    from: entorno.CORREO_REMITENTE,
    to: correo.para,
    subject: correo.asunto,
    html: correo.html,
    text: correo.texto,
  });
}
