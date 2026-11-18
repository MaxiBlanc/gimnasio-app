-- CreateEnum
CREATE TYPE "tipo_aviso" AS ENUM ('POR_VENCER', 'VENCIDO');

-- CreateTable
CREATE TABLE "ingresos" (
    "id" UUID NOT NULL,
    "gimnasio_id" UUID NOT NULL,
    "socio_id" UUID NOT NULL,
    "cuota_vencida" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingresos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avisos_enviados" (
    "id" UUID NOT NULL,
    "gimnasio_id" UUID NOT NULL,
    "socio_id" UUID NOT NULL,
    "tipo" "tipo_aviso" NOT NULL,
    "mes" TEXT NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avisos_enviados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ingresos_gimnasio_id_creado_en_idx" ON "ingresos"("gimnasio_id", "creado_en");

-- CreateIndex
CREATE INDEX "ingresos_socio_id_creado_en_idx" ON "ingresos"("socio_id", "creado_en");

-- CreateIndex
CREATE UNIQUE INDEX "avisos_enviados_socio_id_tipo_mes_key" ON "avisos_enviados"("socio_id", "tipo", "mes");

-- AddForeignKey
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_gimnasio_id_fkey" FOREIGN KEY ("gimnasio_id") REFERENCES "gimnasios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingresos" ADD CONSTRAINT "ingresos_socio_id_gimnasio_id_fkey" FOREIGN KEY ("socio_id", "gimnasio_id") REFERENCES "socios"("id", "gimnasio_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avisos_enviados" ADD CONSTRAINT "avisos_enviados_gimnasio_id_fkey" FOREIGN KEY ("gimnasio_id") REFERENCES "gimnasios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avisos_enviados" ADD CONSTRAINT "avisos_enviados_socio_id_gimnasio_id_fkey" FOREIGN KEY ("socio_id", "gimnasio_id") REFERENCES "socios"("id", "gimnasio_id") ON DELETE CASCADE ON UPDATE CASCADE;
