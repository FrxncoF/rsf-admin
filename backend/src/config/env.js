import path from 'node:path';

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

const jwtSecret = process.env.JWT_SECRET || (isProd ? '' : 'dev-only-insecure-secret-change-me-0123456789');
if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET debe tener al menos 32 caracteres');
}

const jwtExpiresHours = Number(process.env.JWT_EXPIRES_HOURS || 12);

export const env = Object.freeze({
  nodeEnv,
  isProd,
  port: Number(process.env.PORT || 4000),
  jwtSecret,
  jwtExpiresHours,
  cookieName: 'rsf_session',
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  uploadDir: path.resolve(process.env.UPLOAD_DIR || 'uploads'),
  maxPhotoBytes: 5 * 1024 * 1024,
  // API key de la CMF para el valor de la UF; sin ella (o si falla) se usa mindicador.cl
  cmfApiKey: process.env.APIKEYCMF || '',
  backupDir: path.resolve(process.env.BACKUP_DIR || 'backups'),
  backupKeep: Number(process.env.BACKUP_KEEP || 14),
  appVersion: process.env.APP_VERSION || '',
  // Dirección pública del sitio (enlaces en los correos). Se configura: no se toma del request.
  appUrl: (process.env.APP_URL || 'http://localhost').replace(/\/+$/, ''),
  // Correo saliente. Prioridad: API de Zoho por HTTPS (DigitalOcean bloquea los puertos SMTP)
  // → SMTP → consola (sin credenciales, los correos se muestran en el registro del servidor).
  zoho: {
    clientId: process.env.ZOHO_CLIENT_ID || '',
    clientSecret: process.env.ZOHO_CLIENT_SECRET || '',
    refreshToken: process.env.ZOHO_REFRESH_TOKEN || '',
    accountId: process.env.ZOHO_ACCOUNT_ID || '',
    // Centro de datos de la cuenta (.com = EE.UU.; .eu, .in, .com.au… según donde se creó)
    accountsUrl: (process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.com').replace(/\/+$/, ''),
    mailUrl: (process.env.ZOHO_MAIL_URL || 'https://mail.zoho.com').replace(/\/+$/, ''),
  },
  smtp: {
    host: process.env.SMTP_HOST || 'smtppro.zoho.com',
    port: Number(process.env.SMTP_PORT || 465),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_APP_PASSWORD || '',
    from: process.env.MAIL_FROM || '"Soporte Residencia San Francisco" <soporte@residenciasanfrancisco.cl>',
  },
  // Cuenta SOPORTE inicial (opcional). Si el correo ya existe, se promueve a SOPORTE.
  support: {
    email: (process.env.SUPPORT_EMAIL || '').trim().toLowerCase(),
    password: process.env.SUPPORT_PASSWORD || '',
    name: process.env.SUPPORT_NAME || 'Soporte',
  },
  admin: {
    email: process.env.ADMIN_EMAIL || '',
    password: process.env.ADMIN_PASSWORD || '',
    name: process.env.ADMIN_NAME || 'Administradora',
  },
});
