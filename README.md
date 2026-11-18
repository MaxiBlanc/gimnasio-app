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

| Capa          | Tecnología                                                                               |
| ------------- | ---------------------------------------------------------------------------------------- |
| Frontend      | React 19 + TypeScript (Vite), React Router, TanStack Query, React Hook Form, CSS Modules |
| Backend       | Node.js + Express 5 + TypeScript                                                         |
| Base de datos | PostgreSQL + Prisma                                                                      |
| Validación    | Zod (esquemas compartidos entre front y back)                                            |
| Autenticación | JWT con roles + refresh token en cookie httpOnly                                         |
| Tests         | Vitest + Supertest                                                                       |
| Desarrollo    | Docker (Postgres y Mailpit)                                                              |
| Deploy        | Vercel + Neon                                                                            |

## Estructura

```
apps/
  api/                 Backend (Express)
  web/                 Frontend (React)
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
npm run dev:web          # (en otra terminal) web en http://localhost:5173
```

Probar que la API responde: <http://localhost:3000/api/salud>. La app se usa desde <http://localhost:5173>.

> **Windows / PowerShell:** si aparece _"la ejecución de scripts está deshabilitada"_, usá `npm.cmd` en lugar de `npm`, o habilitá los scripts para tu usuario con `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

### Scripts útiles

| Script                | Qué hace                                                               |
| --------------------- | ---------------------------------------------------------------------- |
| `npm run dev:api`     | Levanta la API y la reinicia al guardar cambios                        |
| `npm run dev:web`     | Levanta la web (Vite) con recarga instantánea                          |
| `npm run build`       | Compila la web para producción (en `apps/web/dist`)                    |
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

## Panel del súper-admin

Solo accesible con rol `SUPERADMIN`. Los gimnasios no se registran solos: los da de alta el súper-admin.

| Endpoint                         | Qué hace                                                      |
| -------------------------------- | ------------------------------------------------------------- |
| `GET /api/admin/gimnasios`       | Lista los gimnasios con su cantidad de socios y usuarios      |
| `GET /api/admin/gimnasios/:id`   | Detalle de un gimnasio con su personal                        |
| `POST /api/admin/gimnasios`      | Crea un gimnasio **y su dueño** en una sola transacción       |
| `PATCH /api/admin/gimnasios/:id` | Edita nombre, logo y colores, o lo suspende (`activo: false`) |

- El **slug** (la dirección `/g/power-gym`) no se puede cambiar después, para no romper los enlaces.
- **Suspender** un gimnasio cierra al instante las sesiones de todo su personal y sus socios.

## Planes y descuentos

| Endpoint                    | Dueño | Recepción |
| --------------------------- | :---: | :-------: |
| `GET /api/planes`           |  ✅   |    ✅     |
| `POST /api/planes`          |  ✅   |           |
| `PATCH /api/planes/:id`     |  ✅   |           |
| `GET /api/descuentos`       |  ✅   |    ✅     |
| `POST /api/descuentos`      |  ✅   |           |
| `PATCH /api/descuentos/:id` |  ✅   |           |

- Un plan tiene precio y **duración en meses** (1 = mensual, 3 = trimestral…).
- Un descuento es un **porcentaje** (hasta 100 %) o un **monto fijo** en pesos.
- No se borran: se **desactivan**, porque tienen socios y pagos asociados.
- Cambiar el precio de un plan **no modifica los pagos ya registrados**; rige desde el próximo pago.
- Si se pide un plan o descuento de **otro gimnasio**, la API responde 404, como si no existiera.

## Socios

| Endpoint                                    |              Dueño              | Recepción | Profesor |
| ------------------------------------------- | :-----------------------------: | :-------: | :------: |
| `GET /api/socios?busqueda=&estado=&pagina=` |               ✅                |    ✅     |    ✅    |
| `GET /api/socios/resumen-cuotas`            |               ✅                |    ✅     |          |
| `GET /api/socios/:id`                       |               ✅                |    ✅     |    ✅    |
| `POST /api/socios`                          |               ✅                |    ✅     |          |
| `PATCH /api/socios/:id`                     |               ✅                |    ✅     |          |
| `POST /api/socios/:id/reenviar-activacion`  |               ✅                |    ✅     |          |
| `POST /api/cuenta-socio/activar`            | Público (con el token del mail) |           |          |

- **DNI único por gimnasio**; se acepta con o sin puntos y se guarda solo con números.
- **Búsqueda** por nombre, apellido o DNI, **sin importar acentos ni mayúsculas**: "perez" encuentra a "Pérez". Usa una columna normalizada (`texto_busqueda`) que mantiene la API.
- **Baja lógica:** un socio dado de baja (`activo: false`) no se borra, no aparece en el listado salvo con `incluirBajas=true`, y se cierran sus sesiones.
- **Estado de cuota:** cada socio trae `cuota: { estado, vencimiento }`, calculado al momento con las [reglas de la cuota](#reglas-de-la-cuota). El vencimiento es el último día pagado (los pagos anulados no cuentan).
- **Filtro por estado:** `?estado=VENCIDO` lista los morosos. El filtro se resuelve **en SQL** (no trae todos los socios a memoria) y un test verifica que coincida, socio por socio, con la regla de la función pura.
- **Resumen:** `resumen-cuotas` devuelve cuántos socios activos hay en cada estado.

### Activación de la cuenta del socio

1. Al dar de alta un socio, se le manda un **mail con un link** para crear su contraseña (vence en 7 días).
2. El socio abre el link y elige su contraseña. El link **sirve una sola vez**.
3. Recepción puede **reenviar** el mail; el link anterior deja de servir.

Así, para crear la contraseña hay que tener acceso al mail del socio: no alcanza con saber su DNI. Si el mail no se puede enviar, el socio se crea igual y la API devuelve `correoEnviado: false`.

En desarrollo los mails **no salen a internet**: los atrapa Mailpit y se ven en <http://localhost:8025>.

## Configuración del gimnasio

`GET /api/mi-gimnasio` (todo el personal) y `PATCH /api/mi-gimnasio` (solo el dueño).

| Campo                  | Por defecto | Para qué sirve                                        |
| ---------------------- | :---------: | ----------------------------------------------------- |
| `logoUrl`              |      —      | Logo del gimnasio (URL https)                         |
| `colorPrimario`        |  `#E4FF3A`  | Color de la marca                                     |
| `colorSecundario`      |  `#111111`  | Color de fondo de la marca                            |
| `diaCierreCobro`       |     10      | Desde el día siguiente, una cuota impaga es "vencida" |
| `diasAvisoVencimiento` |      5      | Días antes de fin de mes en que pasa a "por vencer"   |
| `minutosPermanencia`   |     90      | Cuánto cuenta un ingreso para la ocupación            |
| `capacidadMaxima`      |      —      | Para mostrar la ocupación como porcentaje             |

Siempre es el gimnasio **del token**: un dueño no puede tocar la configuración de otro gimnasio. El nombre y el slug solo los cambia el súper-admin.

## Pagos

| Endpoint                                        | Dueño | Recepción |
| ----------------------------------------------- | :---: | :-------: |
| `GET /api/socios/:id/pagos`                     |  ✅   |    ✅     |
| `GET /api/socios/:id/pagos/vista-previa?desde=` |  ✅   |    ✅     |
| `POST /api/socios/:id/pagos`                    |  ✅   |    ✅     |
| `POST /api/pagos/:id/anular`                    |  ✅   |           |

**Qué meses cubre un pago:** meses calendario completos, según la duración del plan. Si no se indica `desde`:

- Si el socio **ya tiene pagado** el mes actual (o más), se cobra **el mes siguiente** a lo último pagado.
- Si **no** lo tiene, se cobra **el mes actual**. Los meses que no vino no se cobran.

**Cuánto se cobra:** lo calcula la API (nunca lo manda el cliente) con el precio del plan y el descuento activo del socio. Se calcula en **centavos enteros** para evitar errores de redondeo, y los montos quedan **guardados en el pago**: si después cambia el precio, el historial no se altera.

**Reglas:**

- Un socio **no puede tener dos pagos vigentes para el mismo mes**. Lo controla la API (error claro) y, por si dos personas cobran a la vez, también la base (restricción `EXCLUDE`).
- No se cobra a socios dados de baja ni con un plan desactivado.
- **Solo el dueño anula** pagos, con un motivo. El pago anulado no se borra (queda quién, cuándo y por qué) y el mes queda libre para cargar el pago correcto.
- La forma de pago (efectivo, transferencia, otro) es **solo informativa**: la app no procesa cobros.

## Etapa 2: socios, ingreso, ocupación, mails y tablero

### Cuenta del socio (celular)

- El socio entra por `/g/<gimnasio>/socio` con **DNI y contraseña** (la que eligió con el link de activación). Ve su cuota con el color del estado, su plan, sus pagos, cuántas veces vino en el mes y la ocupación del gimnasio.
- **Un solo sistema de sesión para todos:** el token de acceso del socio lleva `rol: 'SOCIO'` y la tabla `sesiones` guarda un `usuarioId` **o** un `socioId`. Refrescar, cerrar sesión y `/yo` funcionan igual.
- **Las rutas del panel están cerradas para los socios sin hacer nada especial:** `permitirRoles()` solo acepta roles del personal, así que `'SOCIO'` nunca pasa. Las del socio usan `soloSocios`, y el id sale del token (cada socio ve solo **su** cuenta).

### Tablet de ingreso

- El usuario "Pantalla de ingreso" (rol `KIOSCO`) entra directo a `/ingreso`: teclado numérico grande (también anda con un teclado físico o un lector). Dueño y recepción la tienen en el menú, por si la tablet falla.
- **Cuota vencida** (pasado el día de cierre, 10 por defecto): la pantalla avisa en rojo, pero **la entrada se registra igual** y queda marcada (`cuotaVencida`). Dejarlo pasar o no es decisión del gimnasio.
- Si el mismo socio marca dos veces dentro del tiempo de permanencia, no se cuenta de nuevo.

### Ocupación estimada

No hay registro de salida, así que **suponemos que cada socio se queda `minutosPermanencia`** (90 por defecto, configurable). La ocupación son los socios distintos que entraron en esa ventana. Con la capacidad máxima cargada se muestra el nivel: tranqui (menos del 40 %), movido (menos del 75 %) o lleno. Se actualiza sola cada minuto.

### Mails automáticos (Vercel Cron)

- Un cron diario (`0 12 * * *`, 9:00 en Argentina; el plan gratis permite uno por día) llama a `GET /api/cron/avisos`.
  - **Por vencer:** en los últimos días del mes, a quien pagó este mes pero no el siguiente.
  - **Vencida:** pasado el día de cierre, a quien no pagó este mes.
- La ruta solo responde con el header `Authorization: Bearer <CRON_SECRET>`, que Vercel agrega solo. Se compara en tiempo constante.
- La tabla `avisos_enviados` (con `@@unique([socioId, tipo, mes])`) evita repetir un aviso. Si un mail falla, no se anota y se reintenta al día siguiente.

### Tablero del dueño

En el inicio del panel: cobrado en el mes (y contra el anterior), socios activos y altas, entradas de hoy y de la semana, y dos gráficos: **entradas por día** (últimas 2 semanas) y **promedio por hora** (últimas 4 semanas). Las agrupaciones se hacen en SQL con la zona horaria de Argentina; si no, alguien que entra a las 22 h contaría para el día siguiente. Los gráficos son HTML y CSS, sin librería: para una sola serie alcanza. Cada barra muestra su valor al pasar el mouse, y hay una tabla oculta para lectores de pantalla.

## Web

La app web está en `apps/web`. Pantallas:

| Ruta                      | Quién                | Qué es                                                                |
| ------------------------- | -------------------- | --------------------------------------------------------------------- |
| `/`                       | Todos                | Elegir el gimnasio (recuerda el último que usaste)                    |
| `/g/:slug`                | Personal             | Login con el nombre y los colores del gimnasio                        |
| `/g/:slug/activar?token=` | Socio                | Crear la contraseña desde el link del mail de bienvenida              |
| `/panel`                  | Personal             | Inicio: resumen de cuotas del mes (cada estado lleva al listado)      |
| `/panel/socios`           | Dueño, recep., profe | Listado con búsqueda, filtro por estado de cuota y paginado           |
| `/panel/socios/:id`       | Dueño, recep., profe | Ficha: estado, datos, pagos, cobrar cuota, reenviar mail, dar de baja |
| `/panel/socios/nuevo`     | Dueño, recepción     | Alta de socio (también `/panel/socios/:id/editar`)                    |
| `/panel/planes`           | Dueño                | Planes y descuentos                                                   |
| `/panel/configuracion`    | Dueño                | Logo, colores, día de cierre, días de aviso, permanencia, capacidad   |
| `/admin/ingresar`         | Súper-admin          | Login del súper-admin                                                 |
| `/admin`                  | Súper-admin          | Gimnasios: alta, detalle, edición y suspensión                        |

El profesor ve los socios pero no sus pagos; la anulación de pagos es solo del dueño.

Decisiones:

- **Primero el gimnasio, después el login.** `/g/power-gym` pide la marca a `GET /api/publico/gimnasios/:slug` (público: solo nombre, logo y colores) y muestra la pantalla con los colores del gimnasio antes de entrar.
- **Cada gimnasio con su marca.** Los colores se pasan a variables CSS (`--marca`, `--marca-oscura`). El color del texto sobre la marca (negro o blanco) se calcula con la fórmula de contraste de WCAG, así un gimnasio amarillo no queda con botones ilegibles.
- **Estados de la cuota con los colores de los discos olímpicos:** verde (al día), amarillo (por vencer), azul (pendiente) y rojo (vencido). Se usan igual en toda la app.
- **Tipografía:** Archivo, una sola familia con eje de ancho: angosta y pesada para títulos y números (como la rotulación de un gimnasio), normal para el texto. Se sirve desde el propio sitio (sin Google Fonts), así funciona también sin conexión.
- **Modo claro y oscuro:** sigue al dispositivo, o se elige con el botón del panel.
- **El token de acceso vive solo en memoria**, no en `localStorage` (donde un script inyectado lo podría robar). Al recargar se recupera con la cookie httpOnly de refresco. Si un pedido da 401, el cliente refresca el token y lo reintenta una vez; si varios fallan juntos, comparten un único refresco.
- **En desarrollo, Vite reenvía `/api` a la API**, así el navegador ve un solo sitio, igual que en producción en Vercel: la cookie `sameSite: strict` funciona sin configuración extra.
- **Cobro en dos pasos:** primero la API calcula qué meses y cuánto (vista previa) y después se registra exactamente ese mes. El monto nunca lo escribe el usuario.
- **Los filtros del listado viven en la URL** (`?estado=VENCIDO&busqueda=lopez`): se puede recargar, volver desde la ficha o compartir el link sin perderlos.
- **TanStack Query** guarda en caché lo que trae la API; después de cobrar, editar o anular se invalida todo lo de socios, así el listado, el resumen y la ficha quedan al día.
- **PWA instalable:** manifest e íconos, y un service worker propio (`public/sw.js`) que **nunca guarda la API en caché** (cuotas y pagos tienen que ser siempre los reales). Guarda los archivos de Vite (llevan un hash en el nombre) y la última versión de la página para abrir sin conexión. Solo se registra en producción: para probarlo, `npm run build` y `npm run preview -w @gimnasio/web` (http://localhost:4173).
- **Las rutas protegidas son solo comodidad**: la seguridad real está en la API, que valida el rol en cada pedido.

## Deploy (Vercel + Neon, plan gratis)

Demo online: https://gimnasio-app-flax.vercel.app

- **Todo en un solo proyecto de Vercel:** la web se sirve como archivos estáticos y la API entera corre como **una función** en `/api/*`. Al estar en el mismo dominio, la cookie de refresco sigue siendo `sameSite: strict` y no hace falta CORS.
- **Lo armamos nosotros** con `scripts/construir-vercel.mjs` (Build Output API de Vercel): Vite compila la web y **esbuild empaqueta la API en un solo archivo** (incluye el paquete compartido y el cliente de Prisma). Así evitamos que la detección automática de Vercel se confunda con el monorepo.
- **Base de datos:** Neon (Postgres serverless), creada desde la pestaña Storage del proyecto. Vercel inyecta `DATABASE_URL` sola.
- **Variables en Vercel (Production):** `DATABASE_URL`, `JWT_SECRETO`, `NODE_ENV=production`, `ORIGEN_WEB` (la URL pública, para los links de activación) y `CRON_SECRET` (para los mails automáticos).
- **Correo:** Gmail por SMTP (gratis, hasta ~500 mails por día) con una cuenta creada solo para la app y una **contraseña de aplicación** de Google. Variables: `SMTP_HOST=smtp.gmail.com`, `SMTP_PUERTO=465`, `SMTP_USUARIO`, `SMTP_CONTRASENA` y `CORREO_REMITENTE`. El código no cambia: es el mismo SMTP que Mailpit en desarrollo.
- **Socios de demo en producción:** tienen mails `gimnasioapp.avisos+nombre@gmail.com`. Gmail ignora lo que va después del `+`, así que los avisos de prueba llegan a la casilla de la app y nunca a terceros.

Para deployar una versión nueva (necesita `npx vercel login` una vez):

```bash
npm run build:vercel
npm run deploy
```

Migraciones nuevas contra Neon, con la URL **sin pooler** (`DATABASE_URL_UNPOOLED`) en un `.env.produccion` local (está en `.gitignore`):

```bash
cd apps/api && node --env-file=../../.env.produccion ../../node_modules/prisma/build/index.js migrate deploy
```

El seed acepta `SEED_CONTRASENA_STAFF` y `SEED_CONTRASENA_SOCIO`, para que la demo online **no** use las contraseñas de prueba que figuran abajo.

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

**Personal** — contraseña de todos: `Gimnasio123`. El personal entra por <http://localhost:5173/g/power-gym> (o `/g/titan-fitness`); el súper-admin por <http://localhost:5173/admin/ingresar>.

| Rol                 | Gimnasio      | Email                    |
| ------------------- | ------------- | ------------------------ |
| Súper-admin         | —             | `admin@gimnasioapp.com`  |
| Dueño               | Power Gym     | `dueno@powergym.com`     |
| Recepción           | Power Gym     | `recepcion@powergym.com` |
| Profesor            | Power Gym     | `profe@powergym.com`     |
| Pantalla de ingreso | Power Gym     | `ingreso@powergym.com`   |
| Dueña               | Titan Fitness | `duena@titanfitness.com` |

**Socios de Power Gym** (cada uno es un caso de prueba):

| Socio          | DNI        | Situación                                                                                                 |
| -------------- | ---------- | --------------------------------------------------------------------------------------------------------- |
| Juan Pérez     | `30111222` | Al día. **Cuenta activada:** contraseña `Socio1234` (entra por <http://localhost:5173/g/power-gym/socio>) |
| María Gómez    | `32444555` | Al día con plan trimestral                                                                                |
| Sofía Martínez | `41222333` | Al día con descuento de estudiante (10%)                                                                  |
| Valentina Díaz | `39123456` | Ya pagó el mes que viene                                                                                  |
| Carlos López   | `28999000` | Debe el mes actual (pendiente o vencido según el día)                                                     |
| Diego Ruiz     | `35666777` | Debe dos meses y tiene un pago anulado                                                                    |
| Ana Torres     | `44888999` | Recién anotada, nunca pagó                                                                                |

El seed también carga **entradas de ejemplo** de las últimas 4 semanas, para que el tablero y la ocupación tengan datos.

Titan Fitness tiene un socio con el **mismo DNI** que Juan Pérez, para comprobar que el DNI es único por gimnasio y que los datos no se mezclan.
