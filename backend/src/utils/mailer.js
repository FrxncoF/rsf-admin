import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

/**
 * Envío de correos. Tres modos, en este orden:
 *  1. 'zoho-api': API de Zoho Mail por HTTPS (puerto 443). Es el modo de producción:
 *     DigitalOcean bloquea los puertos SMTP (25/465/587) de sus servidores.
 *  2. 'smtp':     Zoho por SMTP SSL (sirve donde los puertos de correo estén abiertos).
 *  3. 'console':  sin credenciales, el correo se muestra en la consola (pruebas locales).
 * En todos los casos se envía a nombre del alias MAIL_FROM (soporte@…).
 */
const zohoConfigured = () => Boolean(env.zoho.clientId && env.zoho.clientSecret && env.zoho.refreshToken);
const smtpConfigured = () => Boolean(env.smtp.user && env.smtp.pass);

export const mailMode = () => (zohoConfigured() ? 'zoho-api' : smtpConfigured() ? 'smtp' : 'console');
export const mailConfigured = () => mailMode() !== 'console';

/** "Soporte Residencia" <soporte@dominio.cl> → soporte@dominio.cl */
const fromEmail = () => env.smtp.from.match(/<([^>]+)>/)?.[1] ?? env.smtp.from.trim();

// ---------------------------------------------------------------------
// API de Zoho Mail (OAuth: refresh token → access token de 1 hora)
// ---------------------------------------------------------------------
const zohoState = { token: null, expiresAt: 0, accountId: null };

async function zohoFetch(url, options = {}) {
  const res = await fetch(url, { ...options, signal: AbortSignal.timeout(15_000) });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

async function zohoAccessToken() {
  if (zohoState.token && Date.now() < zohoState.expiresAt - 60_000) return zohoState.token;
  const params = new URLSearchParams({
    refresh_token: env.zoho.refreshToken,
    client_id: env.zoho.clientId,
    client_secret: env.zoho.clientSecret,
    grant_type: 'refresh_token',
  });
  const { body } = await zohoFetch(`${env.zoho.accountsUrl}/oauth/v2/token`, { method: 'POST', body: params });
  if (!body.access_token) throw new Error(`Zoho no entregó el token (${body.error ?? 'respuesta inesperada'})`);
  zohoState.token = body.access_token;
  zohoState.expiresAt = Date.now() + Number(body.expires_in ?? 3600) * 1000;
  return zohoState.token;
}

/** Id de la cuenta de Zoho (de ZOHO_ACCOUNT_ID o, si falta, se consulta una vez). */
async function zohoAccountId(token) {
  if (env.zoho.accountId) return env.zoho.accountId;
  if (zohoState.accountId) return zohoState.accountId;
  const { res, body } = await zohoFetch(`${env.zoho.mailUrl}/api/accounts`, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
  const id = body?.data?.[0]?.accountId;
  if (!res.ok || !id) throw new Error(`No se pudo leer la cuenta de Zoho (${body?.data?.errorCode ?? res.status})`);
  zohoState.accountId = id;
  return id;
}

async function sendViaZohoApi({ to, subject, text, html }) {
  const token = await zohoAccessToken();
  const accountId = await zohoAccountId(token);
  const { res, body } = await zohoFetch(`${env.zoho.mailUrl}/api/accounts/${accountId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fromAddress: fromEmail(),
      toAddress: to,
      subject,
      content: html ?? text,
      mailFormat: html ? 'html' : 'plaintext',
      askReceipt: 'no',
    }),
  });
  if (!res.ok || body?.status?.code !== 200) {
    if (res.status === 401) zohoState.token = null; // token vencido o revocado: se pide otro la próxima vez
    const detail = body?.data?.moreInfo ?? body?.status?.description ?? `HTTP ${res.status}`;
    throw new Error(`Zoho rechazó el envío: ${detail}`);
  }
}

// ---------------------------------------------------------------------
// SMTP
// ---------------------------------------------------------------------
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

/** Envía un correo. Devuelve { sent, mode }. En modo consola no se envía: se muestra en el registro. */
export async function sendMail({ to, subject, text, html }) {
  const mode = mailMode();
  if (mode === 'zoho-api') {
    await sendViaZohoApi({ to, subject, text, html });
    return { sent: true, mode };
  }
  if (mode === 'smtp') {
    await getTransporter().sendMail({ from: env.smtp.from, to, subject, text, html });
    return { sent: true, mode };
  }
  console.log(
    [
      '',
      '========== [correo · modo prueba: sin credenciales de envío] ==========',
      `Para:    ${to}`,
      `De:      ${env.smtp.from}`,
      `Asunto:  ${subject}`,
      '-----------------------------------------------------------------------',
      text,
      '=======================================================================',
      '',
    ].join('\n'),
  );
  return { sent: false, console: true, mode };
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
