/**
 * Obtiene el "refresh token" de Zoho Mail a partir del código del Self Client (se usa UNA vez).
 *
 *   1. https://api-console.zoho.com → Add Client → Self Client.
 *   2. Pestaña "Generate Code": Scope  ZohoMail.messages.CREATE,ZohoMail.accounts.READ
 *      Duración 10 minutos → copiar el código.
 *   3. Poner ZOHO_CLIENT_ID y ZOHO_CLIENT_SECRET en el .env del servidor, recrear el backend y correr:
 *        docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend node src/scripts/zohoToken.js <código>
 *   4. Copiar el ZOHO_REFRESH_TOKEN (y el ZOHO_ACCOUNT_ID) que muestra al .env y recrear el backend.
 *
 * El refresh token es una credencial: va solo en el .env del servidor, nunca en el repo.
 */
import { env } from '../config/env.js';

const code = process.argv[2];
if (!code) {
  console.error('Uso: node src/scripts/zohoToken.js <código del Self Client>');
  process.exit(1);
}
if (!env.zoho.clientId || !env.zoho.clientSecret) {
  console.error('Faltan ZOHO_CLIENT_ID y ZOHO_CLIENT_SECRET en el .env (y recrear el backend para que los lea).');
  process.exit(1);
}

const params = new URLSearchParams({
  code,
  client_id: env.zoho.clientId,
  client_secret: env.zoho.clientSecret,
  grant_type: 'authorization_code',
});
const res = await fetch(`${env.zoho.accountsUrl}/oauth/v2/token`, { method: 'POST', body: params });
const body = await res.json().catch(() => ({}));
if (!body.refresh_token) {
  console.error(`Zoho no entregó el refresh token: ${body.error ?? res.status}`);
  console.error('Revisa que el código no haya vencido (dura pocos minutos), que el scope sea el indicado');
  console.error('y que ZOHO_ACCOUNTS_URL corresponda al centro de datos de tu cuenta (.com, .eu, .in…).');
  process.exit(1);
}

// Cuentas disponibles (para fijar ZOHO_ACCOUNT_ID y comprobar que el alias está habilitado)
const accounts = await fetch(`${env.zoho.mailUrl}/api/accounts`, { headers: { Authorization: `Zoho-oauthtoken ${body.access_token}` } })
  .then((r) => r.json())
  .catch(() => ({}));

console.log('\nListo. Agrega esto al .env del servidor (no lo compartas ni lo subas al repo):\n');
console.log(`ZOHO_REFRESH_TOKEN=${body.refresh_token}`);
const first = accounts?.data?.[0];
if (first) {
  console.log(`ZOHO_ACCOUNT_ID=${first.accountId}`);
  const addresses = (first.sendMailDetails ?? []).map((d) => d.fromAddress).filter(Boolean);
  if (addresses.length) console.log(`\nDirecciones desde las que puede enviar esta cuenta: ${addresses.join(', ')}`);
}
console.log('\nDespués recrea el backend y prueba en Soporte → Configuración → "Enviarme un correo de prueba".\n');
