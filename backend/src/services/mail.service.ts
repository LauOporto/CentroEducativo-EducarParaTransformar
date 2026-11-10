import { env } from '../config/env';
import { logger } from '../utils/logger';

// D11: envío de mails por la API HTTPS de Resend, con fetch y sin SDK. El
// plan free de Render bloquea el SMTP saliente (puertos 25, 465 y 587), así
// que nodemailer por SMTP no es una opción. Nadie fuera de este archivo sabe
// qué proveedor se usa: cambiarlo es reescribir solo crearEnviadorMail.

const RESEND_URL = 'https://api.resend.com/emails';
const TIMEOUT_MS = 15_000;

export interface AdjuntoMail {
  nombre: string;
  contenido: Buffer;
}

export interface Mail {
  para: string;
  asunto: string;
  /** Versión en texto plano (la leen los clientes que no muestran HTML). */
  texto: string;
  html?: string;
  adjuntos?: AdjuntoMail[];
}

export interface ResultadoMail {
  /** 'log': no hay proveedor configurado y el mail solo quedó en el log. */
  transporte: 'resend' | 'log';
  id: string | null;
  /** Casilla a la que se mandó de verdad (cambia si hay redirección). */
  destinatario: string;
}

export class MailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MailError';
  }
}

export interface ConfigMail {
  apiKey?: string;
  from: string;
  redirigirA?: string;
  fetch?: typeof fetch;
}

export function crearEnviadorMail(config: ConfigMail) {
  const fetchImpl = config.fetch ?? fetch;

  return async function enviar(mail: Mail): Promise<ResultadoMail> {
    // Con redirección, el asunto conserva a quién iba dirigido el mail.
    const destinatario = config.redirigirA ?? mail.para;
    const asunto = config.redirigirA ? `[para: ${mail.para}] ${mail.asunto}` : mail.asunto;
    const adjuntos = mail.adjuntos ?? [];

    if (!config.apiKey) {
      logger.info('Mail sin enviar (no hay RESEND_API_KEY): solo se registra', {
        to: destinatario,
        asunto,
        texto: mail.texto,
        adjuntos: adjuntos.map((a) => a.nombre),
      });
      return { transporte: 'log', id: null, destinatario };
    }

    let respuesta: Response;
    try {
      respuesta = await fetchImpl(RESEND_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: config.from,
          to: [destinatario],
          subject: asunto,
          text: mail.texto,
          ...(mail.html ? { html: mail.html } : {}),
          ...(adjuntos.length
            ? { attachments: adjuntos.map((a) => ({ filename: a.nombre, content: a.contenido.toString('base64') })) }
            : {}),
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new MailError(
        `No se pudo conectar con el proveedor de mails: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const datos = (await respuesta.json().catch(() => null)) as { id?: string; message?: string } | null;
    if (!respuesta.ok) {
      throw new MailError(
        `El proveedor de mails rechazó el envío (${respuesta.status}): ${datos?.message ?? 'sin detalle'}`,
      );
    }
    // Solo metadatos: el contenido (por ejemplo, un código de recuperación)
    // nunca queda en los logs de producción.
    logger.info('Mail enviado', { to: destinatario, asunto, id: datos?.id ?? null, adjuntos: adjuntos.length });
    return { transporte: 'resend', id: datos?.id ?? null, destinatario };
  };
}

// En los tests nunca se manda un mail real ni se redirige, aunque el .env
// local tenga la key o MAIL_REDIRECT_TO (los tests verifican el destinatario).
const enTests = env.NODE_ENV === 'test';
export const enviarMail = crearEnviadorMail({
  apiKey: enTests ? undefined : env.RESEND_API_KEY,
  from: env.MAIL_FROM,
  redirigirA: enTests ? undefined : env.MAIL_REDIRECT_TO,
});

// ---- Plantilla HTML ----------------------------------------------------------

const escaparHtml = (texto: string) =>
  texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface ContenidoMail {
  saludo: string;
  parrafos: string[];
  /** Filas "etiqueta: valor" que se muestran como tabla (ej. el detalle de una factura). */
  detalle?: [string, string][];
  /** Fila final destacada (ej. el total). */
  destacado?: [string, string];
}

// HTML simple con estilos en línea (los clientes de mail ignoran <style>),
// con la paleta del campus web.
export function htmlMail({ saludo, parrafos, detalle, destacado }: ContenidoMail): string {
  const filas = (detalle ?? [])
    .map(
      ([etiqueta, valor]) =>
        `<tr><td style="padding:6px 0;color:#4A5873">${escaparHtml(etiqueta)}</td><td style="padding:6px 0;text-align:right;color:#16243F">${escaparHtml(valor)}</td></tr>`,
    )
    .join('');
  const total = destacado
    ? `<tr><td style="padding:10px 0 0;border-top:1px solid #E3E7EE;font-weight:700;color:#16243F">${escaparHtml(destacado[0])}</td><td style="padding:10px 0 0;border-top:1px solid #E3E7EE;text-align:right;font-weight:700;color:#16243F">${escaparHtml(destacado[1])}</td></tr>`
    : '';
  const tabla =
    filas || total ? `<table style="width:100%;border-collapse:collapse;margin:16px 0">${filas}${total}</table>` : '';

  return `<!doctype html><html lang="es"><body style="margin:0;padding:24px;background:#F7F8FA;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#16243F">
<div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E3E7EE;border-radius:12px;padding:28px">
<p style="margin:0 0 20px;font-family:Georgia,serif;font-size:20px;color:#1D63B4">Educar para Transformar</p>
<p style="margin:0 0 12px">${escaparHtml(saludo)}</p>
${parrafos.map((p) => `<p style="margin:0 0 12px">${escaparHtml(p)}</p>`).join('\n')}
${tabla}
<p style="margin:24px 0 0;font-size:13px;color:#8D97AC">Este es un mensaje automático del Centro Educativo Educar para Transformar. No respondas a este correo.</p>
</div></body></html>`;
}
