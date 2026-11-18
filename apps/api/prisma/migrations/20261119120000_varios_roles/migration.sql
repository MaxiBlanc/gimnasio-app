-- Un usuario puede tener varios roles (ej. recepción y profe).
-- Escrita a mano: Prisma haría DROP de "rol" + ADD de "roles" vacío y se perderían los datos.

ALTER TABLE "usuarios" ADD COLUMN "roles" "rol"[];
UPDATE "usuarios" SET "roles" = ARRAY["rol"];
ALTER TABLE "usuarios" ALTER COLUMN "roles" SET NOT NULL;

-- El CHECK viejo dependía de "rol": lo rehacemos sobre la lista.
ALTER TABLE "usuarios" DROP CONSTRAINT "usuarios_gimnasio_segun_rol";
ALTER TABLE "usuarios" DROP COLUMN "rol";

ALTER TABLE "usuarios"
  ADD CONSTRAINT "usuarios_con_algun_rol" CHECK (cardinality("roles") >= 1),
  -- El súper-admin va solo y sin gimnasio; el resto, siempre con gimnasio.
  ADD CONSTRAINT "usuarios_gimnasio_segun_rol" CHECK (
    CASE WHEN 'SUPERADMIN' = ANY("roles")
      THEN "roles" = ARRAY['SUPERADMIN']::"rol"[] AND "gimnasio_id" IS NULL
      ELSE "gimnasio_id" IS NOT NULL
    END
  );
