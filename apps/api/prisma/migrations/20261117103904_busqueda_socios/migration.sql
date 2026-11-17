-- AlterTable
ALTER TABLE "socios" ADD COLUMN     "texto_busqueda" TEXT NOT NULL DEFAULT '';

-- Completa la columna para los socios que ya existían (escrito a mano).
-- translate() reemplaza cada letra acentuada por su versión sin acento, igual que hace la API.
UPDATE "socios"
SET "texto_busqueda" = lower(translate(
  "nombre" || ' ' || "apellido" || ' ' || "dni",
  'áéíóúàèìòùäëïöüâêîôûñçÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÂÊÎÔÛÑÇ',
  'aeiouaeiouaeiouaeiouncAEIOUAEIOUAEIOUAEIOUNC'
));
