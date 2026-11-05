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
  admin: {
    email: process.env.ADMIN_EMAIL || '',
    password: process.env.ADMIN_PASSWORD || '',
    name: process.env.ADMIN_NAME || 'Administradora',
  },
});
