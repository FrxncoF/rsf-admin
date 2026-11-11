# Residencia San Francisco · Fase 1

Sistema interno de gestión administrativa para la residencia de adultos mayores.

- **Backend:** Node.js 22 + Express 5 + PostgreSQL 17
- **Frontend:** React 19 + Vite + Tailwind CSS 4 + Lucide (componentes estilo shadcn) + PWA
- **Despliegue:** Docker Compose (db · backend · frontend con Nginx)

## Levantar

```bash
cp .env.example .env      # completar claves (ver abajo)
docker compose up --build -d
```

Abrir `http://localhost` (o la IP del Droplet). El primer usuario **ADMIN** se crea al arrancar el
backend con `ADMIN_EMAIL` / `ADMIN_PASSWORD` del `.env`, solo si todavía no existe ningún ADMIN.
Las cuentas de cuidadoras se crean desde **Usuarios** en la app.

Generar secretos:

```bash
openssl rand -hex 48   # JWT_SECRET
openssl rand -hex 18   # POSTGRES_PASSWORD
```

> `db/init.sql` es el esquema base y solo se ejecuta cuando el volumen `pgdata` está vacío.
> Los cambios posteriores están en `backend/migrations/NNN_*.sql`: el backend los aplica solo al
> arrancar y los registra en la tabla `schema_migrations`. Para un cambio de esquema nuevo, crea el
> siguiente archivo numerado; **no edites migraciones ya aplicadas ni re-apliques `init.sql`**.
> Para reiniciar la BD desde cero: `docker compose down -v` (borra datos y fotos).

## Estructura

```
rsf-admin/
├── docker-compose.yml
├── .env.example
├── db/
│   └── init.sql                     # esquema base Fase 1 (users, residents, apoderados)
├── backend/
│   ├── Dockerfile                   # multi-stage, usuario no-root, tini, healthcheck
│   ├── migrations/                  # 001: sedes, apoderados N:M, datos de ingreso y pago
│   └── src/
│       ├── server.js                # arranque, espera BD, migra, crea ADMIN inicial, shutdown limpio
│       ├── app.js                   # helmet, cors, cookies, rutas /api
│       ├── config/env.js
│       ├── db/                      # pool.js, migrate.js
│       ├── middlewares/
│       │   ├── auth.js              # verifyToken + verifyRole(['ADMIN'])
│       │   └── errorHandler.js      # AppError, zod, multer, errores PG (409 duplicados)
│       ├── modules/
│       │   ├── auth/                # /auth/login, /auth/logout, /auth/me
│       │   ├── residents/           # CRUD + estado + foto
│       │   ├── guardians/           # apoderados (1 apoderado → N residentes)
│       │   ├── sites/               # sedes: Los Talaveras, El Curato
│       │   ├── indicators/          # valor UF del día (CMF, respaldo mindicador.cl)
│       │   └── users/               # gestión de cuentas (ADMIN)
│       └── utils/                   # AppError, validación, RUT (módulo 11)
└── frontend/
    ├── Dockerfile                   # build con Node → Nginx alpine
    ├── nginx/                       # SPA + proxy /api + headers de seguridad + caché PWA
    ├── vite.config.js               # vite-plugin-pwa (manifest + service worker)
    ├── public/                      # favicon + íconos PWA (npm run icons para regenerar)
    └── src/
        ├── App.jsx                  # rutas + guards
        ├── lib/                     # api client, utils, rut, phone, money (UF/CLP), hooks
        ├── components/
        │   ├── ui/                  # Button, Input, Dialog, Badge, Card...
        │   └── layout/              # AppLayout, TopBar (sede + UF), Sidebar, MobileDrawer, navigation.js
        ├── features/
        │   ├── auth/                # AuthContext, RequireAuth/RequireRole, LoginPage
        │   ├── residents/
        │   │   ├── admin/           # tabla de gestión + formulario
        │   │   ├── caregiver/       # grilla de tarjetas táctiles
        │   │   └── detail/          # ficha del residente
        │   ├── daily-log/           # bitácora diaria (UI con estado local, Fase 2: conectar API)
        │   ├── guardians/           # módulo Apoderados + buscador/alta reutilizables
        │   ├── sites/               # SiteContext: sede seleccionada global
        │   └── users/
        └── pages/                   # 403 / 404
```

## Rol SOPORTE

Puede todo lo del ADMIN y además la sección **Soporte**: estado del sistema, errores 500, historial de
accesos, respaldos de la BD (uno automático diario después de las 03:00 + manuales, se guardan
`BACKUP_KEEP`), aviso superior para todos y catálogos editables (isapres, ambulancias). En Usuarios puede
reiniciar claves (clave temporal que se debe cambiar al entrar) y cerrar todas las sesiones de alguien.
Un ADMIN no ve ni administra cuentas SOPORTE, ni puede crearlas.

La primera cuenta se crea al arrancar con `SUPPORT_EMAIL` / `SUPPORT_PASSWORD` del `.env`; si ese correo
ya existe (por ejemplo tu cuenta ADMIN), se promueve a SOPORTE sin cambiar su clave.
Para ver el commit desplegado en Soporte → Estado: `GIT_SHA=$(git rev-parse --short HEAD) docker compose up -d --build`.

## API

Todas bajo `/api`. Sesión por cookie `httpOnly` + `SameSite=Strict` (también acepta `Authorization: Bearer <token>`).

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/auth/login` | público (rate-limit 10/15 min) | Inicia sesión |
| POST | `/auth/logout` | — | Cierra sesión |
| GET | `/auth/me` | autenticado | Usuario actual |
| GET | `/residents?search=&site_id=&status=active\|inactive\|all&sort=name\|room\|created&page=&pageSize=` | ADMIN, CUIDADORA | Listado (cuidadora: solo activos, sin RUT ni datos de pago) |
| GET | `/residents/:id` | ADMIN, CUIDADORA | Detalle |
| POST | `/residents` | ADMIN | Crear |
| PUT | `/residents/:id` | ADMIN | Reemplazar |
| PATCH | `/residents/:id/status` | ADMIN | Activar / desactivar (residentes, apoderados y usuarios no se eliminan: la BD bloquea el DELETE) |
| GET / POST / DELETE | `/residents/:id/photo` | GET ambos · resto ADMIN | Foto (JPG/PNG/WEBP, 5 MB) |
| GET / POST / PATCH | `/users`, `/users/:id` | ADMIN | Gestión de cuentas |
| GET / POST / PUT | `/guardians?status=active\|inactive\|all`, `/guardians/:id` | ADMIN | Apoderados |
| PATCH | `/guardians/:id/status` | ADMIN | Desactivar / reactivar (no si es apoderado de residentes activos) |
| GET | `/sites` | autenticado | Sedes |
| GET | `/indicators/uf` | autenticado | UF del día (API CMF con `APIKEYCMF`; si falla, mindicador.cl) |
| POST / DELETE | `/residents/:id/conditions[/:itemId]` | ADMIN | Patologías (se leen en `GET /residents/:id`) |
| POST / PUT / DELETE | `/residents/:id/medications[/:itemId]` | ADMIN | Medicamentos: nombre, dosis, horario, indicaciones |
| GET / POST | `/daily-logs?resident_id=` | ADMIN, CUIDADORA | Fichas diarias (varias por día, no se editan) |
| POST | `/daily-logs/:id/notes` | ADMIN, CUIDADORA | Nota de corrección sobre una ficha |
| GET / POST | `/visits?site_id=&resident_id=` | ADMIN, CUIDADORA | Visitas (apoderado u otra persona) |
| DELETE | `/visits/:id` | ADMIN | Eliminar visita registrada por error |
| GET | `/health` | público | Healthcheck |

## Desarrollo local (sin Docker para el código)

```bash
docker compose up -d db                       # solo PostgreSQL (exponer 5432 si hace falta)
cd backend && cp .env.example .env && npm install && npm run dev
cd frontend && npm install && npm run dev     # http://localhost:5173 (proxy /api → :4000)
```

## Despliegue en DigitalOcean (Droplet)

En el servidor conviven la landing y el admin:

```
/srv/rsf/
├── landing/   ← rsf-landing (estático, servido por el Nginx de Ubuntu)
└── admin/     ← este repo (Docker), con su .env de producción
```

El **Nginx de Ubuntu** recibe `https://admin.residenciasanfrancisco.cl` (certificado con certbot) y lo
reenvía al contenedor frontend en `127.0.0.1:8080`. Ningún contenedor queda expuesto a Internet.
El `docker-compose.override.yml` es solo de desarrollo y no va al servidor.

1. **DNS**: registro `A` de `admin.residenciasanfrancisco.cl` → IP del Droplet.
2. **Código**: `cd /srv/rsf && git clone https://github.com/FrxncoF/rsf-admin.git admin` (rama `main`).
3. **`.env`** en `/srv/rsf/admin` con secretos nuevos (no los de desarrollo), además de
   `COOKIE_SECURE=true`, `TRUST_PROXY=2`, `ADMIN_LOCAL_PORT=8080` y `CORS_ORIGINS=` vacío.
4. **Levantar**:
   `GIT_SHA=$(git rev-parse --short HEAD) docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`
5. **Nginx + HTTPS**: seguir los comandos al inicio de `deploy/nginx-admin.conf` (copiar el sitio,
   `nginx -t`, recargar y `certbot --nginx -d admin.residenciasanfrancisco.cl`).
6. **Datos** (opcional, desde un respaldo): copiar el `.dump` con `scp` a `backups/` y luego
   `docker compose cp backups/ARCHIVO.dump db:/tmp/rsf.dump`,
   `docker compose exec db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists /tmp/rsf.dump'`
   y reiniciar el backend.
7. **Actualizar** después: `git pull` y repetir el paso 4 (las migraciones se aplican solas).

Respaldos: Soporte → Respaldos (diario automático) en el volumen `backups`; fotos en el volumen `uploads`.

## Siguiente fase

- **Bitácora diaria:** la UI ya existe en `frontend/src/features/daily-log/` con estado local.
  Falta crear tablas, endpoints y auditoría, y conectar `useDailyLog.js` al API
  (hoy los datos se pierden al recargar).
- Fuera de alcance en Fase 1: medicamentos, farmacia y auditoría.
