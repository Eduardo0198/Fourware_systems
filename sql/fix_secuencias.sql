-- =============================================
-- Resetea las secuencias SERIAL al valor máximo actual
-- Ejecutar UNA VEZ en Supabase SQL Editor, antes del seed
-- =============================================

SELECT setval(pg_get_serial_sequence('"Campania"',          'id_campania'),     COALESCE((SELECT MAX(id_campania)     FROM "Campania"),          0) + 1, false);
SELECT setval(pg_get_serial_sequence('"Cuenta"',            'id_cuenta'),       COALESCE((SELECT MAX(id_cuenta)       FROM "Cuenta"),            0) + 1, false);
SELECT setval(pg_get_serial_sequence('"Sucursal"',          'id_sucursal'),     COALESCE((SELECT MAX(id_sucursal)     FROM "Sucursal"),           0) + 1, false);
SELECT setval(pg_get_serial_sequence('"BitacoraAuditoria"', 'id_log'),          COALESCE((SELECT MAX(id_log)          FROM "BitacoraAuditoria"),  0) + 1, false);
SELECT setval(pg_get_serial_sequence('"Calificacion"',      'id_calificacion'), COALESCE((SELECT MAX(id_calificacion) FROM "Calificacion"),       0) + 1, false);
