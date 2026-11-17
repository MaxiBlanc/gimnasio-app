# GimnasioApp

Sistema de gestión para gimnasios pensado como **SaaS multi-gimnasio**: una sola aplicación donde cada gimnasio tiene su cuenta, sus datos, su logo y sus colores, sin poder ver los datos de los demás.

> 🚧 En desarrollo. Proyecto de portfolio.

## ¿Qué resuelve?

- **Socios y cuotas:** alta de socios, planes (mensual, trimestral…), descuentos y registro de pagos. Cada socio muestra su estado: al día, por vencer, pendiente o vencido.
- **Ingreso al gimnasio:** pantalla para tablet en recepción donde el socio escribe su DNI. Si la cuota está vencida, se registra igual pero con una alerta.
- **Ocupación en tiempo real:** cuánta gente hay ahora en el gimnasio.
- **Avisos por mail:** cuota por vencer y cuota vencida.
- **Rutinas y clases:** los profes arman rutinas (y plantillas) para cada socio; los socios se anotan a clases con cupo.
- **Panel del dueño:** ingresos del mes, morosos, socios activos, asistencia.

Los pagos se **registran** en el sistema; la app no cobra ni se integra con medios de pago.

### Reglas de la cuota

La cuota se cobra por **mes calendario** (del 1 al último día). Un plan trimestral cubre 3 meses seguidos.

| Estado        | Cuándo                                                                         |
| ------------- | ------------------------------------------------------------------------------ |
| 🟢 Al día     | Tiene pagado el mes actual                                                     |
| 🟡 Por vencer | Pagó el mes actual pero no el siguiente, y faltan ≤ N días para fin de mes (5) |
| 🟠 Pendiente  | No pagó el mes actual y todavía no pasó el día de cierre (10)                  |
| 🔴 Vencido    | No pagó el mes actual y ya pasó el día de cierre                               |

Los valores entre paréntesis son los de por defecto; cada gimnasio los configura.

## Roles

| Rol         | Qué puede hacer                                                    |
| ----------- | ------------------------------------------------------------------ |
| Súper-admin | Da de alta y administra gimnasios                                  |
| Dueño       | Todo dentro de su gimnasio                                         |
| Recepción   | Socios, pagos e ingresos (sin reportes ni configuración)           |
| Profesor    | Rutinas y consulta de socios                                       |
| Pantalla    | Usuario de la tablet de recepción: solo registra ingresos          |
| Socio       | Desde el celular: su cuota, sus rutinas, la ocupación y sus clases |

## Stack

| Capa          | Tecnología                                       |
| ------------- | ------------------------------------------------ |
| Frontend      | React + TypeScript (Vite), PWA                   |
| Backend       | Node.js + Express 5 + TypeScript                 |
| Base de datos | PostgreSQL + Prisma                              |
| Validación    | Zod (esquemas compartidos entre front y back)    |
| Autenticación | JWT con roles + refresh token en cookie httpOnly |
| Tests         | Vitest + Supertest                               |
| Desarrollo    | Docker (Postgres y Mailpit)                      |
| Deploy        | Vercel + Neon                                    |

## Estructura

```
apps/
  api/                 Backend (Express)
  web/                 Frontend (React)          ← próximamente
packages/
  compartido/          Tipos, constantes y esquemas usados por api y web
docker-compose.yml     Postgres de desarrollo, Postgres de tests y Mailpit
```

Es un **monorepo con npm workspaces**: un solo repositorio y un solo `npm install`, y la API y la web importan `@gimnasio/compartido` como si fuera un paquete más.

## Cómo correrlo

Requisitos: **Node 20+** y **Docker Desktop**.

```bash
npm install              # instala las dependencias de todo el monorepo
cp .env.example .env     # variables de entorno locales
npm run db:levantar      # levanta Postgres y Mailpit en Docker
npm run dev:api          # API en http://localhost:3000
```

Probar que la API responde: <http://localhost:3000/api/salud>

### Scripts útiles

| Script                | Qué hace                                        |
| --------------------- | ----------------------------------------------- |
| `npm run dev:api`     | Levanta la API y la reinicia al guardar cambios |
| `npm test`            | Corre los tests de todos los paquetes           |
| `npm run typecheck`   | Verifica los tipos de TypeScript                |
| `npm run lint`        | Revisa el código con ESLint                     |
| `npm run formatear`   | Formatea el código con Prettier                 |
| `npm run db:levantar` | Levanta los contenedores de Docker              |
| `npm run db:bajar`    | Baja los contenedores                           |

### Servicios de desarrollo

| Servicio         | Dirección                                 |
| ---------------- | ----------------------------------------- |
| API              | http://localhost:3000                     |
| Postgres (dev)   | `localhost:5433` usuario/clave `gimnasio` |
| Postgres (tests) | `localhost:5434`                          |
| Mailpit (mails)  | http://localhost:8025                     |

## Usuarios de prueba

Se cargan con el seed (próximamente).
