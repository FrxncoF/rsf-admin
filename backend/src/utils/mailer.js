import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

/**
 * Envío de correos por Zoho Mail (SMTP SSL 465).
 * La app inicia sesión con la cuenta dueña del alias (SMTP_USER) y envía a nombre del alias
 * (MAIL_FROM = soporte@...). Sin credenciales, modo prueba: el correo se muestra en la consola.
 */
export const mailConfigured = () => Boolean(env.smtp.user && env.smtp.pass);

let transporter = null;
function getTransporter() {
  transporter ??= nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: { user: env.smtp.user, pass: env.smtp.pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return transporter;
}

/** Envía un correo. Devuelve { sent: true } o { sent: false, console: true } en modo prueba. */
export async function sendMail({ to, subject, text, html }) {
  if (!mailConfigured()) {
    console.log(
      [
        '',
        '========== [correo · modo prueba: SMTP sin configurar] ==========',
        `Para:    ${to}`,
        `De:      ${env.smtp.from}`,
        `Asunto:  ${subject}`,
        '-----------------------------------------------------------------',
        text,
        '=================================================================',
        '',
      ].join('\n'),
    );
    return { sent: false, console: true };
  }
  await getTransporter().sendMail({ from: env.smtp.from, to, subject, text, html });
  return { sent: true };
}

/** Plantilla simple con el logo y un botón (los clientes de correo no soportan CSS externo). */
export function emailLayout({ title, intro, buttonText, buttonUrl, footer }) {
  const logo = `${env.appUrl}/icons/logo.png`;
  return `<!doctype html>
<html lang="es"><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;padding:28px">
        <tr><td align="center" style="padding-bottom:16px"><img src="${logo}" alt="Residencia San Francisco" width="180" style="display:block;max-width:180px;height:auto"></td></tr>
        <tr><td style="font-size:20px;font-weight:bold;padding-bottom:12px">${title}</td></tr>
        <tr><td style="font-size:15px;line-height:1.6;color:#334155;padding-bottom:20px">${intro}</td></tr>
        <tr><td align="center" style="padding-bottom:20px">
          <a href="${buttonUrl}" style="display:inline-block;background:#2872b8;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px">${buttonText}</a>
        </td></tr>
        <tr><td style="font-size:12px;line-height:1.5;color:#64748b">${footer}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
