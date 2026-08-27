-- Formato del ítem de inventario (catálogo Configuración → Formatos).
-- Los existentes quedan en el formato base «Sin formato».
ALTER TABLE `inventory_items` ADD COLUMN `format_id` integer REFERENCES `formats`(`id`);

UPDATE `inventory_items`
   SET `format_id` = (
     SELECT `id` FROM `formats` WHERE lower(`label`) = lower('Sin formato') LIMIT 1
   )
 WHERE `format_id` IS NULL;
