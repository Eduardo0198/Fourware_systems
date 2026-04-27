-- ********** INICIO U-27: base para estado logistico de reserva **********
-- Guardar el estado logistico actual de una reserva y tambien conservar el historial de cambios

-- Aqui creo el catalogo donde se guardan los estados permitidos
CREATE TABLE IF NOT EXISTS "EstadoLogistico" (
  -- Este id identifica cada estado logistico
  "id_estado_logistico" SMALLINT PRIMARY KEY,
  -- Aqui se guarda el nombre corto del estado
  "nombre" VARCHAR(30) NOT NULL,
  -- Aqui se explica para que sirve ese estado
  "descripcion" VARCHAR(150),
  -- Este campo indica si el estado esta activo
  "activo" SMALLINT DEFAULT 1
);

-- Aqui inserto los estados iniciales que usara logistica.
INSERT INTO "EstadoLogistico" ("id_estado_logistico", "nombre", "descripcion", "activo")
VALUES
  -- La reserva ya fue confirmada pero todavia no se trabaja
  (1, 'Pendiente', 'Reserva confirmada pendiente de preparacion', 1),
  -- Logistica ya empezo a preparar la reserva
  (2, 'En preparacion', 'Reserva en proceso de preparacion', 1),
  -- La reserva ya esta preparada para entregarse
  (3, 'Lista para entrega', 'Reserva preparada para entrega', 1),
  -- La reserva ya fue entregada
  (4, 'Entregada', 'Reserva entregada al concesionario', 1),
  -- La reserva tiene un problema que debe revisarse
  (5, 'Con incidencia', 'Reserva con problema operativo', 1)
-- Esto evita duplicar los estados si el script se ejecuta otra vez
ON CONFLICT ("id_estado_logistico") DO NOTHING;

-- Aqui agrego a Reserva el campo que guardara su estado logistico actual
ALTER TABLE "Reserva"
ADD COLUMN IF NOT EXISTS "id_estado_logistico" SMALLINT DEFAULT 1;

-- Aqui dejo como Pendiente cualquier reserva que no tenga estado logistico.
UPDATE "Reserva"
SET "id_estado_logistico" = 1
WHERE "id_estado_logistico" IS NULL;

-- Aqui creo la tabla que guardara cada cambio de estado logistico
CREATE TABLE IF NOT EXISTS "HistorialEstadoLogistico" (
  -- Identificador unico del movimiento
  "id_historial" SERIAL PRIMARY KEY,
  -- Folio de la reserva que cambio de estado
  "folio" VARCHAR(20) NOT NULL,
  -- Estado que tenia la reserva antes del cambio
  "id_estado_anterior" SMALLINT,
  -- Estado nuevo seleccionado por logistica
  "id_estado_nuevo" SMALLINT NOT NULL,
  -- Comentario opcional util cuando hay incidencia o para explicar el motivo del cambio 
  "observacion" VARCHAR(300),
  -- Fecha y hora en la que se hizo el cambio
  "fecha_cambio" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- Usuario de logistica que hizo la actualizacion
  "correo_logistica" VARCHAR(100) NOT NULL,
  -- Relaciona el historial con la reserva
  CONSTRAINT "historial_estado_fk_reserva"
    FOREIGN KEY ("folio") REFERENCES "Reserva" ("folio"),
  -- Relaciona el estado anterior con el catalogo
  CONSTRAINT "historial_estado_fk_anterior"
    FOREIGN KEY ("id_estado_anterior") REFERENCES "EstadoLogistico" ("id_estado_logistico"),
  -- Relaciona el estado nuevo con el catalogo
  CONSTRAINT "historial_estado_fk_nuevo"
    FOREIGN KEY ("id_estado_nuevo") REFERENCES "EstadoLogistico" ("id_estado_logistico"),
  -- Relaciona el cambio con el usuario que lo hizo
  CONSTRAINT "historial_estado_fk_usuario"
    FOREIGN KEY ("correo_logistica") REFERENCES "Usuario" ("correo")
);

-- Aqui agrego la llave foranea de Reserva hacia EstadoLogistico
DO $$
BEGIN
  -- Primero reviso si la llave ya existe para no crearla dos veces
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reserva_fk_estado_logistico'
  ) THEN
    -- Si no existe, la agrego para asegurar que el estado sea valido
    ALTER TABLE "Reserva"
    ADD CONSTRAINT "reserva_fk_estado_logistico"
    FOREIGN KEY ("id_estado_logistico")
    REFERENCES "EstadoLogistico" ("id_estado_logistico");
  END IF;
END $$;

-- ********** FIN U-27: base para estado logistico de reserva **********
