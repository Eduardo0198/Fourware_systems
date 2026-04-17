-- =============================================
-- Schema PostgreSQL para ppg_preventa
-- =============================================

-- 1. Rol
CREATE TABLE IF NOT EXISTS "Rol" (
  "id_rol"     INT NOT NULL,
  "nombre_rol" VARCHAR(50),
  PRIMARY KEY ("id_rol")
);

-- 2. Privilegio
CREATE TABLE IF NOT EXISTS "Privilegio" (
  "id_privilegio"     INT NOT NULL,
  "nombre_privilegio" VARCHAR(100),
  PRIMARY KEY ("id_privilegio")
);

-- 3. Campania
CREATE TABLE IF NOT EXISTS "Campania" (
  "id_campania"  SERIAL PRIMARY KEY,
  "nombre"       VARCHAR(150),
  "fecha_inicio" DATE,
  "fecha_fin"    DATE,
  "banner"       VARCHAR(255),
  "estatus"      SMALLINT
);

-- 4. Cuenta
CREATE TABLE IF NOT EXISTS "Cuenta" (
  "id_cuenta"    SERIAL PRIMARY KEY,
  "nombre"       VARCHAR(150),
  "RFC"          VARCHAR(13),
  "razon_social" VARCHAR(150),
  "activo"       SMALLINT DEFAULT 1
);

-- 5. Usuario
CREATE TABLE IF NOT EXISTS "Usuario" (
  "correo"      VARCHAR(100) NOT NULL,
  "nombre"      VARCHAR(100) NOT NULL,
  "contrasenia" VARCHAR(255) NOT NULL,
  "tipo"        VARCHAR(50),
  "perfil"      VARCHAR(50),
  "estatus"     SMALLINT DEFAULT 1,
  PRIMARY KEY ("correo")
);

-- 6. Producto (depende de Campania)
CREATE TABLE IF NOT EXISTS "Producto" (
  "SKU"              VARCHAR(20) NOT NULL,
  "nombre_comercial" VARCHAR(150),
  "descripcion"      VARCHAR(2000),
  "precio_unitario"  DECIMAL(10,2),
  "peso_unitario"    DECIMAL(10,2),
  "volumen_unitario" DECIMAL(10,2),
  "medida_primaria"  VARCHAR(50),
  "unidad_venta"     VARCHAR(50),
  "imagen"           VARCHAR(255),
  "activo"           SMALLINT,
  "id_campania"      INT,
  PRIMARY KEY ("SKU"),
  CONSTRAINT "producto_fk_campania" FOREIGN KEY ("id_campania") REFERENCES "Campania" ("id_campania")
);

-- 7. Sucursal (depende de Cuenta)
CREATE TABLE IF NOT EXISTS "Sucursal" (
  "id_sucursal" SERIAL PRIMARY KEY,
  "nombre"      VARCHAR(100),
  "direccion"   VARCHAR(150),
  "municipio"   VARCHAR(100),
  "estado"      VARCHAR(100),
  "region"      VARCHAR(50),
  "telefono"    VARCHAR(20),
  "activo"      SMALLINT DEFAULT 1,
  "id_cuenta"   INT,
  CONSTRAINT "sucursal_fk_cuenta" FOREIGN KEY ("id_cuenta") REFERENCES "Cuenta" ("id_cuenta")
);

-- 8. Reserva (depende de Usuario, Cuenta, Sucursal)
CREATE TABLE IF NOT EXISTS "Reserva" (
  "folio"                     VARCHAR(20) NOT NULL,
  "estatus"                   SMALLINT,
  "fecha"                     DATE,
  "subtotal"                  DECIMAL(10,2),
  "iva"                       DECIMAL(10,2),
  "total"                     DECIMAL(10,2),
  "fecha_cancelacion_reserva" TIMESTAMP,
  "correo"                    VARCHAR(100),
  "id_cuenta"                 INT,
  "id_sucursal"               INT NOT NULL,
  PRIMARY KEY ("folio"),
  CONSTRAINT "reserva_fk_usuario"  FOREIGN KEY ("correo")      REFERENCES "Usuario"  ("correo"),
  CONSTRAINT "reserva_fk_cuenta"   FOREIGN KEY ("id_cuenta")   REFERENCES "Cuenta"   ("id_cuenta"),
  CONSTRAINT "reserva_fk_sucursal" FOREIGN KEY ("id_sucursal") REFERENCES "Sucursal" ("id_sucursal")
);

-- 9. Reserva_Producto (depende de Reserva, Producto)
CREATE TABLE IF NOT EXISTS "Reserva_Producto" (
  "folio"           VARCHAR(20) NOT NULL,
  "SKU"             VARCHAR(20) NOT NULL,
  "cantidad"        INT,
  "precio_aplicado" DECIMAL(10,2),
  "subtotal_linea"  DECIMAL(10,2),
  PRIMARY KEY ("folio", "SKU"),
  CONSTRAINT "rp_fk_reserva"  FOREIGN KEY ("folio") REFERENCES "Reserva"  ("folio"),
  CONSTRAINT "rp_fk_producto" FOREIGN KEY ("SKU")   REFERENCES "Producto" ("SKU")
);

-- 10. BitacoraAuditoria (depende de Usuario)
CREATE TABLE IF NOT EXISTS "BitacoraAuditoria" (
  "id_log"    SERIAL PRIMARY KEY,
  "fecha"     TIMESTAMP,
  "accion"    VARCHAR(200),
  "ip_origen" VARCHAR(45),
  "correo"    VARCHAR(100),
  CONSTRAINT "bitacora_fk_usuario" FOREIGN KEY ("correo") REFERENCES "Usuario" ("correo")
);

-- 11. Calificacion (depende de Usuario, Producto)
CREATE TABLE IF NOT EXISTS "Calificacion" (
  "id_calificacion" SERIAL PRIMARY KEY,
  "estrellas"       INT,
  "fecha"           DATE,
  "comentario"      VARCHAR(1000),
  "correo"          VARCHAR(100),
  "SKU"             VARCHAR(20),
  CONSTRAINT "calificacion_fk_usuario"  FOREIGN KEY ("correo") REFERENCES "Usuario"  ("correo"),
  CONSTRAINT "calificacion_fk_producto" FOREIGN KEY ("SKU")    REFERENCES "Producto" ("SKU")
);

-- 12. Rol_Privilegio (depende de Rol, Privilegio)
CREATE TABLE IF NOT EXISTS "Rol_Privilegio" (
  "id_rol"        INT NOT NULL,
  "id_privilegio" INT NOT NULL,
  PRIMARY KEY ("id_rol", "id_privilegio"),
  CONSTRAINT "rp_fk_rol"       FOREIGN KEY ("id_rol")        REFERENCES "Rol"       ("id_rol"),
  CONSTRAINT "rp_fk_privilegio" FOREIGN KEY ("id_privilegio") REFERENCES "Privilegio" ("id_privilegio")
);

-- 13. Usuario_Cuenta (depende de Usuario, Cuenta)
CREATE TABLE IF NOT EXISTS "Usuario_Cuenta" (
  "correo"    VARCHAR(100) NOT NULL,
  "id_cuenta" INT NOT NULL,
  PRIMARY KEY ("correo", "id_cuenta"),
  CONSTRAINT "uc_fk_usuario" FOREIGN KEY ("correo")    REFERENCES "Usuario" ("correo"),
  CONSTRAINT "uc_fk_cuenta"  FOREIGN KEY ("id_cuenta") REFERENCES "Cuenta"  ("id_cuenta")
);

-- 14. Usuario_Rol (depende de Usuario, Rol)
CREATE TABLE IF NOT EXISTS "Usuario_Rol" (
  "correo" VARCHAR(100) NOT NULL,
  "id_rol" INT NOT NULL,
  PRIMARY KEY ("correo", "id_rol"),
  CONSTRAINT "ur_fk_usuario" FOREIGN KEY ("correo")  REFERENCES "Usuario" ("correo"),
  CONSTRAINT "ur_fk_rol"     FOREIGN KEY ("id_rol")  REFERENCES "Rol"     ("id_rol")
);
