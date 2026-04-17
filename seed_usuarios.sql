-- =============================================
-- Seed: Usuarios del equipo + Cuentas y Sucursales
-- Equivalente PostgreSQL del script MySQL original
-- Ejecutar en Supabase SQL Editor
-- =============================================

BEGIN;

-- =========================
-- USUARIOS
-- =========================
INSERT INTO "Usuario" (correo, nombre, contrasenia, tipo, perfil, estatus)
VALUES
  ('cvmscrimaida2023@gmail.com',    'Cristhian Maida',   '$2b$10$SU4YEpKtKCbfQFqmRqeMdetRvrVM8.scTyYvRzNZve4GPYIroc0Uq', 'Externo',  'Concesionario', 1),
  ('gerardomartinezcbj@gmail.com',  'Gerardo Martinez',  '$2b$10$SU4YEpKtKCbfQFqmRqeMdetRvrVM8.scTyYvRzNZve4GPYIroc0Uq', 'Interno',  'Administrador', 1),
  ('joseduardo1604@outlook.com',    'Jose Eduardo',      '$2b$10$SU4YEpKtKCbfQFqmRqeMdetRvrVM8.scTyYvRzNZve4GPYIroc0Uq', 'Interno',  'Logistica',     1),
  ('laurencintora@gmail.com',       'Lauren Cintora',    '$2b$10$SU4YEpKtKCbfQFqmRqeMdetRvrVM8.scTyYvRzNZve4GPYIroc0Uq', 'Interno',  'Marketing',     1)
ON CONFLICT (correo) DO NOTHING;

-- =========================
-- ROLES
-- =========================
INSERT INTO "Usuario_Rol" (correo, id_rol)
VALUES
  ('cvmscrimaida2023@gmail.com',   1),
  ('gerardomartinezcbj@gmail.com', 2),
  ('joseduardo1604@outlook.com',   3),
  ('laurencintora@gmail.com',      4)
ON CONFLICT (correo, id_rol) DO NOTHING;

-- =========================
-- CUENTAS BASICAS + SUCURSALES (una por usuario)
-- Usa DO $$ para capturar el id generado con RETURNING
-- =========================
DO $$
DECLARE
  v_cuenta INT;
BEGIN

  -- Cristhian
  INSERT INTO "Cuenta" (nombre, "RFC", razon_social, activo)
  VALUES ('Cuenta Cristhian', 'CRI260406AA1', 'Cuenta Comercial Cristhian SA de CV', 1)
  RETURNING id_cuenta INTO v_cuenta;

  INSERT INTO "Usuario_Cuenta" (correo, id_cuenta) VALUES ('cvmscrimaida2023@gmail.com', v_cuenta);

  INSERT INTO "Sucursal" (nombre, direccion, municipio, estado, region, telefono, activo, id_cuenta)
  VALUES ('Sucursal Cristhian Puebla', 'Av. Juarez 100', 'Puebla', 'Puebla', 'Centro', '2221000001', 1, v_cuenta);

  -- Gerardo
  INSERT INTO "Cuenta" (nombre, "RFC", razon_social, activo)
  VALUES ('Cuenta Gerardo', 'GER260406AA2', 'Cuenta Comercial Gerardo SA de CV', 1)
  RETURNING id_cuenta INTO v_cuenta;

  INSERT INTO "Usuario_Cuenta" (correo, id_cuenta) VALUES ('gerardomartinezcbj@gmail.com', v_cuenta);

  INSERT INTO "Sucursal" (nombre, direccion, municipio, estado, region, telefono, activo, id_cuenta)
  VALUES ('Sucursal Gerardo CDMX', 'Av. Reforma 200', 'CDMX', 'CDMX', 'Centro', '5510000002', 1, v_cuenta);

  -- Jose
  INSERT INTO "Cuenta" (nombre, "RFC", razon_social, activo)
  VALUES ('Cuenta Jose', 'JED260406AA3', 'Cuenta Comercial Jose SA de CV', 1)
  RETURNING id_cuenta INTO v_cuenta;

  INSERT INTO "Usuario_Cuenta" (correo, id_cuenta) VALUES ('joseduardo1604@outlook.com', v_cuenta);

  INSERT INTO "Sucursal" (nombre, direccion, municipio, estado, region, telefono, activo, id_cuenta)
  VALUES ('Sucursal Jose Monterrey', 'Av. Constitucion 300', 'Monterrey', 'Nuevo Leon', 'Norte', '8110000003', 1, v_cuenta);

  -- Lauren
  INSERT INTO "Cuenta" (nombre, "RFC", razon_social, activo)
  VALUES ('Cuenta Lauren', 'LAU260406AA4', 'Cuenta Comercial Lauren SA de CV', 1)
  RETURNING id_cuenta INTO v_cuenta;

  INSERT INTO "Usuario_Cuenta" (correo, id_cuenta) VALUES ('laurencintora@gmail.com', v_cuenta);

  INSERT INTO "Sucursal" (nombre, direccion, municipio, estado, region, telefono, activo, id_cuenta)
  VALUES ('Sucursal Lauren Guadalajara', 'Av. Vallarta 400', 'Guadalajara', 'Jalisco', 'Occidente', '3310000004', 1, v_cuenta);

END $$;

-- =========================
-- CUENTAS AUTOMOTRICES DE CRISTHIAN (3 concesionarios reales)
-- =========================
DO $$
DECLARE
  v_cuenta INT;
BEGIN

  -- Grupo Automotriz Angelópolis
  INSERT INTO "Cuenta" (nombre, "RFC", razon_social, activo)
  VALUES ('Grupo Automotriz Angelópolis', 'GAA260406P11', 'Grupo Automotriz Angelópolis SA de CV', 1)
  RETURNING id_cuenta INTO v_cuenta;

  INSERT INTO "Usuario_Cuenta" (correo, id_cuenta) VALUES ('cvmscrimaida2023@gmail.com', v_cuenta);

  INSERT INTO "Sucursal" (nombre, direccion, municipio, estado, region, telefono, activo, id_cuenta)
  VALUES
    ('Volkswagen Angelópolis', 'Blvd. del Niño Poblano 2510, Reserva Territorial Atlixcáyotl', 'Puebla', 'Puebla', 'Centro', '2223034501', 1, v_cuenta),
    ('Volkswagen Las Ánimas',  'Circuito Juan Pablo II 3117, Las Ánimas', 'Puebla', 'Puebla', 'Centro', '2223034502', 1, v_cuenta);

  -- Grupo Automotriz Cholula
  INSERT INTO "Cuenta" (nombre, "RFC", razon_social, activo)
  VALUES ('Grupo Automotriz Cholula', 'GAC260406P12', 'Grupo Automotriz Cholula SA de CV', 1)
  RETURNING id_cuenta INTO v_cuenta;

  INSERT INTO "Usuario_Cuenta" (correo, id_cuenta) VALUES ('cvmscrimaida2023@gmail.com', v_cuenta);

  INSERT INTO "Sucursal" (nombre, direccion, municipio, estado, region, telefono, activo, id_cuenta)
  VALUES
    ('Volkswagen Cholula',  'Boulevard Forjadores de Puebla 3401', 'San Pedro Cholula', 'Puebla', 'Centro', '2223034601', 1, v_cuenta),
    ('Volkswagen Momoxpan', 'Camino Real a Momoxpan 201', 'San Pedro Cholula', 'Puebla', 'Centro', '2223034602', 1, v_cuenta);

  -- Grupo Automotriz Tlaxcala
  INSERT INTO "Cuenta" (nombre, "RFC", razon_social, activo)
  VALUES ('Grupo Automotriz Tlaxcala', 'GAT260406T13', 'Grupo Automotriz Tlaxcala SA de CV', 1)
  RETURNING id_cuenta INTO v_cuenta;

  INSERT INTO "Usuario_Cuenta" (correo, id_cuenta) VALUES ('cvmscrimaida2023@gmail.com', v_cuenta);

  INSERT INTO "Sucursal" (nombre, direccion, municipio, estado, region, telefono, activo, id_cuenta)
  VALUES
    ('Volkswagen Tlaxcala Centro', 'Blvd. Guillermo Valle 95', 'Tlaxcala', 'Tlaxcala', 'Centro', '2463034701', 1, v_cuenta),
    ('Volkswagen Apizaco',         'Carretera Tlaxcala-Apizaco Km 3.5', 'Apizaco', 'Tlaxcala', 'Centro', '2463034702', 1, v_cuenta);

END $$;

COMMIT;

-- =========================
-- VERIFICACION
-- =========================
SELECT u.correo, u.nombre, r.nombre_rol
FROM "Usuario" u
JOIN "Usuario_Rol" ur ON ur.correo = u.correo
JOIN "Rol" r ON r.id_rol = ur.id_rol
WHERE u.correo IN (
  'cvmscrimaida2023@gmail.com',
  'gerardomartinezcbj@gmail.com',
  'joseduardo1604@outlook.com',
  'laurencintora@gmail.com'
);
