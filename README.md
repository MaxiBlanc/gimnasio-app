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

El proyecto está pensado para funcionar **con costo cero** usando planes gratuitos (Vercel, Neon, Resend). Por eso, por ejemplo, el logo de cada gimnasio se carga como **URL de una imagen** en lugar de subir el archivo.

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
npm install              # instala las dependencias y genera el cliente de Prisma
cp .env.example .env     # variables de entorno locales
npm run db:levantar      # levanta Postgres y Mailpit en Docker
npm run db:migrar        # crea las tablas
npm run db:seed          # carga los datos de prueba
npm run dev:api          # API en http://localhost:3000
```

Probar que la API responde: <http://localhost:3000/api/salud>

> **Windows / PowerShell:** si aparece _"la ejecución de scripts está deshabilitada"_, usá `npm.cmd` en lugar de `npm`, o habilitá los scripts para tu usuario con `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

### Scripts útiles

| Script                | Qué hace                                                               |
| --------------------- | ---------------------------------------------------------------------- |
| `npm run dev:api`     | Levanta la API y la reinicia al guardar cambios                        |
| `npm test`            | Corre los tests de todos los paquetes                                  |
| `npm run typecheck`   | Verifica los tipos de TypeScript                                       |
| `npm run lint`        | Revisa el código con ESLint                                            |
| `npm run formatear`   | Formatea el código con Prettier                                        |
| `npm run db:levantar` | Levanta los contenedores de Docker                                     |
| `npm run db:bajar`    | Baja los contenedores                                                  |
| `npm run db:migrar`   | Aplica las migraciones pendientes (y crea nuevas si cambió el esquema) |
| `npm run db:seed`     | Borra los datos y carga los de prueba                                  |
| `npm run db:reset`    | Borra la base entera, la recrea desde cero y corre el seed             |
| `npm run db:studio`   | Abre Prisma Studio para ver y editar la base en el navegador           |

## Base de datos

El esquema está en [`apps/api/prisma/schema.prisma`](apps/api/prisma/schema.prisma) y las migraciones en `apps/api/prisma/migrations`.

Decisiones principales:

- **Multi-gimnasio a nivel base de datos.** Las tablas de negocio llevan `gimnasio_id`, y las relaciones entre ellas usan **claves foráneas compuestas** `(id, gimnasio_id)`: Postgres impide, por ejemplo, asignar a un socio un plan de otro gimnasio.
- **Reglas del negocio como restricciones** (`CHECK` y `EXCLUDE`), escritas a mano en la migración inicial: un pago cubre meses completos, los montos cierran (`final = base - descuento`), y un socio **no puede tener dos pagos vigentes para el mismo mes**.
- **El vencimiento se calcula** a partir de los pagos no anulados; no se guarda aparte.
- **Los pagos no se borran:** se anulan registrando quién, cuándo y por qué.
- **Montos en `DECIMAL`**, nunca en coma flotante.
- **IDs UUID v7:** no se pueden adivinar y se ordenan por fecha de creación.

## Autenticación

| Endpoint                     | Qué hace                                                           |
| ---------------------------- | ------------------------------------------------------------------ |
| `POST /api/auth/login`       | Login del personal: `{ gimnasio: "power-gym", email, contrasena }` |
| `POST /api/auth/admin/login` | Login del súper-admin: `{ email, contrasena }`                     |
| `POST /api/auth/refrescar`   | Canjea la cookie de refresco por un token de acceso nuevo          |
| `POST /api/auth/salir`       | Cierra la sesión (revoca la cookie de refresco)                    |
| `GET /api/auth/yo`           | Devuelve el usuario logueado                                       |

- **Dos tokens.** El de **acceso** es un JWT de 15 minutos que viaja en `Authorization: Bearer …`. El de **refresco** dura 30 días, vive en una cookie `httpOnly` (el JavaScript de la página no la puede leer) y se guarda **hasheado** en la tabla `sesiones`, así que se puede revocar.
- **Rotación:** cada vez que se usa el token de refresco, se revoca y se entrega uno nuevo.
- **Sin pistas para atacantes:** email inexistente, contraseña incorrecta o usuario desactivado devuelven el mismo error y tardan lo mismo.
- **Aislamiento:** el gimnasio de cada consulta sale **del token**, nunca de datos que mande el cliente.
- **Permisos por rol:** `permitirRoles('DUENO', 'RECEPCION')`. 401 = no estás logueado; 403 = no tenés permiso.

## Tests

`npm test` corre los tests contra una **base de datos aparte** (contenedor `postgres_test`), así que necesita Docker levantado. Antes de empezar aplica las migraciones a esa base, y cada test arranca con la base vacía y sus propios datos.

### Servicios de desarrollo

| Servicio         | Dirección                                 |
| ---------------- | ----------------------------------------- |
| API              | http://localhost:3000                     |
| Postgres (dev)   | `localhost:5433` usuario/clave `gimnasio` |
| Postgres (tests) | `localhost:5434`                          |
| Mailpit (mails)  | http://localhost:8025                     |

## Usuarios de prueba

Se cargan con `npm run db:seed`. Son datos ficticios solo para desarrollo.

**Personal** — contraseña de todos: `Gimnasio123`

| Rol                 | Gimnasio      | Email                    |
| ------------------- | ------------- | ------------------------ |
| Súper-admin         | —             | `admin@gimnasioapp.com`  |
| Dueño               | Power Gym     | `dueno@powergym.com`     |
| Recepción           | Power Gym     | `recepcion@powergym.com` |
| Profesor            | Power Gym     | `profe@powergym.com`     |
| Pantalla de ingreso | Power Gym     | `ingreso@powergym.com`   |
| Dueña               | Titan Fitness | `duena@titanfitness.com` |

**Socios de Power Gym** (cada uno es un caso de prueba):

| Socio          | DNI        | Situación                                             |
| -------------- | ---------- | ----------------------------------------------------- |
| Juan Pérez     | `30111222` | Al día. **Cuenta activada:** contraseña `Socio1234`   |
| María Gómez    | `32444555` | Al día con plan trimestral                            |
| Sofía Martínez | `41222333` | Al día con descuento de estudiante (10%)              |
| Valentina Díaz | `39123456` | Ya pagó el mes que viene                              |
| Carlos López   | `28999000` | Debe el mes actual (pendiente o vencido según el día) |
| Diego Ruiz     | `35666777` | Debe dos meses y tiene un pago anulado                |
| Ana Torres     | `44888999` | Recién anotada, nunca pagó                            |

Titan Fitness tiene un socio con el **mismo DNI** que Juan Pérez, para comprobar que el DNI es único por gimnasio y que los datos no se mezclan.
