-- Corrige el tipo de la columna "fecha" en Reserva de DATE a TIMESTAMP.
-- Los registros existentes quedan con hora 00:00:00 (sin perder la fecha).
-- Los nuevos INSERTs con CLOCK_TIMESTAMP() guardarán la hora exacta.
ALTER TABLE "Reserva"
    ALTER COLUMN "fecha" TYPE TIMESTAMP
    USING "fecha"::TIMESTAMP;
