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

> `db/init.sql` solo se ejecuta cuando el volumen `pgdata` está vacío. Para reiniciar la BD desde cero:
> `docker compose down -v` (borra datos y fotos).

## Estructura

```
rsf-admin/
├── docker-compose.yml
├── .env.example
├── db/
│   └── init.sql                     # users + residents, índices, constraints, triggers
├── backend/
│   ├── Dockerfile                   # multi-stage, usuario no-root, tini, healthcheck
│   └── src/
│       ├── server.js                # arranque, espera BD, crea ADMIN inicial, shutdown limpio
│       ├── app.js                   # helmet, cors, cookies, rutas /api
│       ├── config/env.js
│       ├── db/pool.js
│       ├── middlewares/
│       │   ├── auth.js              # verifyToken + verifyRole(['ADMIN'])
│       │   └── errorHandler.js      # AppError, zod, multer, errores PG (409 duplicados)
│       ├── modules/
│       │   ├── auth/                # /auth/login, /auth/logout, /auth/me
│       │   ├── residents/           # CRUD + estado + foto
│       │   └── users/               # gestión de cuentas (ADMIN)
│       └── utils/                   # AppError, validación, RUT (módulo 11)
└── frontend/
    ├── Dockerfile                   # build con Node → Nginx alpine
    ├── nginx/                       # SPA + proxy /api + headers de seguridad + caché PWA
    ├── vite.config.js               # vite-plugin-pwa (manifest + service worker)
    ├── public/                      # favicon + íconos PWA (npm run icons para regenerar)
    └── src/
        ├── App.jsx                  # rutas + guards
        ├── lib/                     # api client, utils, rut, hooks
        ├── components/
        │   ├── ui/                  # Button, Input, Dialog, Badge, Card...
        │   └── layout/              # AppLayout, Sidebar (desktop colapsable), MobileDrawer, navigation.js
        ├── features/
        │   ├── auth/                # AuthContext, RequireAuth/RequireRole, LoginPage
        │   ├── residents/
        │   │   ├── admin/           # tabla de gestión + formulario
        │   │   ├── caregiver/       # grilla de tarjetas táctiles
        │   │   └── detail/          # ficha del residente + MedicalRecordPlaceholder
        │   └── users/
        └── pages/                   # 403 / 404
```

## API

Todas bajo `/api`. Sesión por cookie `httpOnly` + `SameSite=Strict` (también acepta `Authorization: Bearer <token>`).

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/auth/login` | público (rate-limit 10/15 min) | Inicia sesión |
| POST | `/auth/logout` | — | Cierra sesión |
| GET | `/auth/me` | autenticado | Usuario actual |
| GET | `/residents?search=&status=active\|inactive\|all&sort=name\|room\|created&page=&pageSize=` | ADMIN, CUIDADORA | Listado (cuidadora: solo activos, sin RUT) |
| GET | `/residents/:id` | ADMIN, CUIDADORA | Detalle |
| POST | `/residents` | ADMIN | Crear |
| PUT | `/residents/:id` | ADMIN | Reemplazar |
| PATCH | `/residents/:id/status` | ADMIN | Activar / desactivar |
| DELETE | `/residents/:id` | ADMIN | Eliminar definitivamente |
| GET / POST / DELETE | `/residents/:id/photo` | GET ambos · resto ADMIN | Foto (JPG/PNG/WEBP, 5 MB) |
| GET / POST / PATCH | `/users`, `/users/:id` | ADMIN | Gestión de cuentas |
| GET | `/health` | público | Healthcheck |

## Desarrollo local (sin Docker para el código)

```bash
docker compose up -d db                       # solo PostgreSQL (exponer 5432 si hace falta)
cd backend && cp .env.example .env && npm install && npm run dev
cd frontend && npm install && npm run dev     # http://localhost:5173 (proxy /api → :4000)
```

## Despliegue en DigitalOcean (Droplet)

1. Droplet Ubuntu con Docker (imagen "Docker" del Marketplace).
2. Clonar el repo, crear `.env` con secretos reales y `docker compose up --build -d`.
3. **HTTPS es obligatorio para producción**: la PWA (service worker / "Agregar a pantalla de inicio")
   solo funciona en HTTPS fuera de `localhost`, y la cookie de sesión debe ir con `COOKIE_SECURE=true`.
   Opción simple: apuntar un dominio al Droplet y poner Caddy delante (`HTTP_PORT=8080` y Caddy
   haciendo `reverse_proxy localhost:8080` con certificado automático).
4. Firewall: abrir solo 22, 80 y 443. La BD y el backend no exponen puertos.
5. Respaldos: volumen `pgdata` (`pg_dump`) y volumen `uploads` (fotos).

## Siguiente fase

- **Ficha médica:** reemplazar `frontend/src/features/residents/detail/MedicalRecordPlaceholder.jsx`
  por el formulario construido desde el PDF, con su tabla y endpoints propios.
- Fuera de alcance en Fase 1: medicamentos, farmacia y auditoría.
