-- CreateEnum
CREATE TYPE "rol" AS ENUM ('SUPERADMIN', 'DUENO', 'RECEPCION', 'PROFESOR', 'KIOSCO');

-- CreateEnum
CREATE TYPE "tipo_descuento" AS ENUM ('PORCENTAJE', 'MONTO_FIJO');

-- CreateEnum
CREATE TYPE "forma_pago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'OTRO');

-- CreateEnum
CREATE TYPE "tipo_token_socio" AS ENUM ('ACTIVACION', 'RECUPERACION');

-- CreateTable
CREATE TABLE "gimnasios" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo_url" TEXT,
    "color_primario" TEXT NOT NULL DEFAULT '#E4FF3A',
    "color_secundario" TEXT NOT NULL DEFAULT '#111111',
    "minutos_permanencia" INTEGER NOT NULL DEFAULT 90,
    "dia_cierre_cobro" INTEGER NOT NULL DEFAULT 10,
    "dias_aviso_vencimiento" INTEGER NOT NULL DEFAULT 5,
    "capacidad_maxima" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "gimnasios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "gimnasio_id" UUID,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "hash_contrasena" TEXT NOT NULL,
    "rol" "rol" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones" (
    "id" UUID NOT NULL,
    "usuario_id" UUID,
    "socio_id" UUID,
    "hash_token" TEXT NOT NULL,
    "expira_en" TIMESTAMPTZ(3) NOT NULL,
    "revocada_en" TIMESTAMPTZ(3),
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sesiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planes" (
    "id" UUID NOT NULL,
    "gimnasio_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "precio" DECIMAL(12,2) NOT NULL,
    "duracion_meses" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "planes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "descuentos" (
    "id" UUID NOT NULL,
    "gimnasio_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "tipo_descuento" NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "descuentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "socios" (
    "id" UUID NOT NULL,
    "gimnasio_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emergencia_nombre" TEXT NOT NULL,
    "emergencia_telefono" TEXT NOT NULL,
    "plan_id" UUID NOT NULL,
    "descuento_id" UUID,
    "hash_contrasena" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "socios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens_socio" (
    "id" UUID NOT NULL,
    "gimnasio_id" UUID NOT NULL,
    "socio_id" UUID NOT NULL,
    "tipo" "tipo_token_socio" NOT NULL,
    "hash_token" TEXT NOT NULL,
    "expira_en" TIMESTAMPTZ(3) NOT NULL,
    "usado_en" TIMESTAMPTZ(3),
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_socio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" UUID NOT NULL,
    "gimnasio_id" UUID NOT NULL,
    "socio_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "periodo_desde" DATE NOT NULL,
    "periodo_hasta" DATE NOT NULL,
    "monto_base" DECIMAL(12,2) NOT NULL,
    "monto_descuento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "monto_final" DECIMAL(12,2) NOT NULL,
    "descuento_nombre" TEXT,
    "forma_pago" "forma_pago" NOT NULL,
    "registrado_por_id" UUID NOT NULL,
    "anulado_en" TIMESTAMPTZ(3),
    "anulado_por_id" UUID,
    "motivo_anulacion" TEXT,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gimnasios_slug_key" ON "gimnasios"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_gimnasio_id_email_key" ON "usuarios"("gimnasio_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "sesiones_hash_token_key" ON "sesiones"("hash_token");

-- CreateIndex
CREATE UNIQUE INDEX "planes_gimnasio_id_nombre_key" ON "planes"("gimnasio_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "planes_id_gimnasio_id_key" ON "planes"("id", "gimnasio_id");

-- CreateIndex
CREATE UNIQUE INDEX "descuentos_gimnasio_id_nombre_key" ON "descuentos"("gimnasio_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "descuentos_id_gimnasio_id_key" ON "descuentos"("id", "gimnasio_id");

-- CreateIndex
CREATE INDEX "socios_gimnasio_id_apellido_nombre_idx" ON "socios"("gimnasio_id", "apellido", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "socios_gimnasio_id_dni_key" ON "socios"("gimnasio_id", "dni");

-- CreateIndex
CREATE UNIQUE INDEX "socios_id_gimnasio_id_key" ON "socios"("id", "gimnasio_id");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_socio_hash_token_key" ON "tokens_socio"("hash_token");

-- CreateIndex
CREATE INDEX "pagos_gimnasio_id_socio_id_periodo_hasta_idx" ON "pagos"("gimnasio_id", "socio_id", "periodo_hasta");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_gimnasio_id_fkey" FOREIGN KEY ("gimnasio_id") REFERENCES "gimnasios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "socios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planes" ADD CONSTRAINT "planes_gimnasio_id_fkey" FOREIGN KEY ("gimnasio_id") REFERENCES "gimnasios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "descuentos" ADD CONSTRAINT "descuentos_gimnasio_id_fkey" FOREIGN KEY ("gimnasio_id") REFERENCES "gimnasios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "socios" ADD CONSTRAINT "socios_gimnasio_id_fkey" FOREIGN KEY ("gimnasio_id") REFERENCES "gimnasios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "socios" ADD CONSTRAINT "socios_plan_id_gimnasio_id_fkey" FOREIGN KEY ("plan_id", "gimnasio_id") REFERENCES "planes"("id", "gimnasio_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "socios" ADD CONSTRAINT "socios_descuento_id_gimnasio_id_fkey" FOREIGN KEY ("descuento_id", "gimnasio_id") REFERENCES "descuentos"("id", "gimnasio_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens_socio" ADD CONSTRAINT "tokens_socio_gimnasio_id_fkey" FOREIGN KEY ("gimnasio_id") REFERENCES "gimnasios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens_socio" ADD CONSTRAINT "tokens_socio_socio_id_gimnasio_id_fkey" FOREIGN KEY ("socio_id", "gimnasio_id") REFERENCES "socios"("id", "gimnasio_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_gimnasio_id_fkey" FOREIGN KEY ("gimnasio_id") REFERENCES "gimnasios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_socio_id_gimnasio_id_fkey" FOREIGN KEY ("socio_id", "gimnasio_id") REFERENCES "socios"("id", "gimnasio_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_plan_id_gimnasio_id_fkey" FOREIGN KEY ("plan_id", "gimnasio_id") REFERENCES "planes"("id", "gimnasio_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_anulado_por_id_fkey" FOREIGN KEY ("anulado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Restricciones escritas A MANO (Prisma no las puede expresar en schema.prisma).
-- Son la última línea de defensa: aunque el código tenga un bug, la base rechaza
-- datos que rompan las reglas del negocio.
-- ─────────────────────────────────────────────────────────────────────────────

-- Gimnasios: configuración con valores razonables y slug apto para URL.
ALTER TABLE "gimnasios"
  ADD CONSTRAINT "gimnasios_slug_formato" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  ADD CONSTRAINT "gimnasios_dia_cierre_valido" CHECK ("dia_cierre_cobro" BETWEEN 1 AND 28),
  ADD CONSTRAINT "gimnasios_dias_aviso_valido" CHECK ("dias_aviso_vencimiento" BETWEEN 0 AND 28),
  ADD CONSTRAINT "gimnasios_minutos_validos" CHECK ("minutos_permanencia" > 0),
  ADD CONSTRAINT "gimnasios_capacidad_valida" CHECK ("capacidad_maxima" IS NULL OR "capacidad_maxima" > 0);

-- Usuarios: el súper-admin es el ÚNICO sin gimnasio, y todo el resto tiene uno.
ALTER TABLE "usuarios"
  ADD CONSTRAINT "usuarios_gimnasio_segun_rol" CHECK (("rol" = 'SUPERADMIN') = ("gimnasio_id" IS NULL));

-- Sesiones: pertenecen a un usuario o a un socio, exactamente uno de los dos.
ALTER TABLE "sesiones"
  ADD CONSTRAINT "sesiones_un_solo_duenio" CHECK (num_nonnulls("usuario_id", "socio_id") = 1);

-- Planes y descuentos.
ALTER TABLE "planes"
  ADD CONSTRAINT "planes_precio_valido" CHECK ("precio" >= 0),
  ADD CONSTRAINT "planes_duracion_valida" CHECK ("duracion_meses" BETWEEN 1 AND 24);

ALTER TABLE "descuentos"
  ADD CONSTRAINT "descuentos_valor_valido" CHECK (
    "valor" > 0 AND ("tipo" <> 'PORCENTAJE' OR "valor" <= 100)
  );

-- Pagos: períodos de meses completos, montos coherentes y anulación completa.
ALTER TABLE "pagos"
  ADD CONSTRAINT "pagos_desde_primer_dia" CHECK (EXTRACT(DAY FROM "periodo_desde") = 1),
  ADD CONSTRAINT "pagos_hasta_ultimo_dia" CHECK (
    "periodo_hasta" = (date_trunc('month', "periodo_hasta") + INTERVAL '1 month - 1 day')::date
  ),
  ADD CONSTRAINT "pagos_periodo_ordenado" CHECK ("periodo_desde" <= "periodo_hasta"),
  ADD CONSTRAINT "pagos_montos_validos" CHECK (
    "monto_base" >= 0 AND "monto_descuento" >= 0 AND "monto_final" >= 0
    AND "monto_final" = "monto_base" - "monto_descuento"
  ),
  ADD CONSTRAINT "pagos_anulacion_completa" CHECK (
    num_nulls("anulado_en", "anulado_por_id", "motivo_anulacion") IN (0, 3)
  );

-- Pagos: un socio no puede tener dos pagos VIGENTES que cubran el mismo mes.
-- Es una "restricción de exclusión": rechaza filas cuyos rangos de fechas (&&) se superpongan
-- para el mismo socio (=). Los pagos anulados no cuentan (WHERE).
-- btree_gist es una extensión oficial de Postgres que permite combinar "=" y "&&".
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "pagos"
  ADD CONSTRAINT "pagos_sin_superposicion" EXCLUDE USING gist (
    "socio_id" WITH =,
    daterange("periodo_desde", "periodo_hasta", '[]') WITH &&
  ) WHERE ("anulado_en" IS NULL);
