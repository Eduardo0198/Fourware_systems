CREATE DATABASE ppg_preventa;
USE ppg_preventa;
SHOW DATABASES;
SHOW TABLES;
SHOW TABLE STATUS;
SHOW CREATE DATABASE ppg_preventa;

CREATE TABLE Usuario (
correo VARCHAR(100) PRIMARY KEY,
nombre VARCHAR(100) NOT NULL,
contrasenia VARCHAR(255) NOT NULL,
tipo VARCHAR(50),
perfil VARCHAR(50),
region VARCHAR(50),
estatus TINYINT DEFAULT 1
);

CREATE TABLE Cuenta (
id_cuenta INT AUTO_INCREMENT PRIMARY KEY,
RFC VARCHAR(13),
direccion VARCHAR(150),
municipio VARCHAR(100),
estado VARCHAR(100),
razon_social VARCHAR(150),
telefono VARCHAR(20),
activo TINYINT DEFAULT 1
);

CREATE TABLE Rol (
id_rol INT PRIMARY KEY,
nombre_rol VARCHAR(50)
);

CREATE TABLE Privilegio (
id_privilegio INT PRIMARY KEY,
nombre_privilegio VARCHAR(100)
);

CREATE TABLE Usuario_Rol (
correo VARCHAR(100),
id_rol INT,
PRIMARY KEY (correo,id_rol),
FOREIGN KEY (correo) REFERENCES Usuario(correo),
FOREIGN KEY (id_rol) REFERENCES Rol(id_rol)
);

CREATE TABLE Rol_Privilegio (
id_rol INT,
id_privilegio INT,
PRIMARY KEY (id_rol,id_privilegio),
FOREIGN KEY (id_rol) REFERENCES Rol(id_rol),
FOREIGN KEY (id_privilegio) REFERENCES Privilegio(id_privilegio)
);

CREATE TABLE Campania (
id_campania INT AUTO_INCREMENT PRIMARY KEY,
nombre VARCHAR(150),
fecha_inicio DATE,
fecha_fin DATE,
banner VARCHAR(255),
estatus TINYINT
);

CREATE TABLE Producto (
SKU VARCHAR(20) PRIMARY KEY,
nombre_comercial VARCHAR(150),
descripcion VARCHAR(2000),
precio_unitario DECIMAL(10,2),
peso_unitario DECIMAL(10,2),
volumen_unitario DECIMAL(10,2),
medida_primaria VARCHAR(50),
unidad_venta VARCHAR(50),
imagen VARCHAR(255),
activo TINYINT,
id_campania INT,
FOREIGN KEY (id_campania) REFERENCES Campania(id_campania)
);

CREATE TABLE Reserva (
folio VARCHAR(20) PRIMARY KEY,
estatus TINYINT,
fecha DATE,
subtotal DECIMAL(10,2),
iva DECIMAL(10,2),
total DECIMAL(10,2),
fecha_cancelacion_reserva DATETIME,
correo VARCHAR(100),
id_cuenta INT,
FOREIGN KEY (correo) REFERENCES Usuario(correo),
FOREIGN KEY (id_cuenta) REFERENCES Cuenta(id_cuenta)
);

CREATE TABLE Reserva_Producto (
folio VARCHAR(20),
SKU VARCHAR(20),
cantidad INT,
precio_aplicado DECIMAL(10,2),
subtotal_linea DECIMAL(10,2),
PRIMARY KEY (folio,SKU),
FOREIGN KEY (folio) REFERENCES Reserva(folio),
FOREIGN KEY (SKU) REFERENCES Producto(SKU)
);

CREATE TABLE Usuario_Cuenta (
correo VARCHAR(100),
id_cuenta INT,
PRIMARY KEY (correo,id_cuenta),
FOREIGN KEY (correo) REFERENCES Usuario(correo),
FOREIGN KEY (id_cuenta) REFERENCES Cuenta(id_cuenta)
);

CREATE TABLE Calificacion (
id_calificacion INT AUTO_INCREMENT PRIMARY KEY,
estrellas INT,
fecha DATE,
comentario VARCHAR(1000),
correo VARCHAR(100),
SKU VARCHAR(20),
FOREIGN KEY (correo) REFERENCES Usuario(correo),
FOREIGN KEY (SKU) REFERENCES Producto(SKU)
);

CREATE TABLE BitacoraAuditoria (
id_log INT AUTO_INCREMENT PRIMARY KEY,
fecha DATETIME,
accion VARCHAR(200),
ip_origen VARCHAR(45),
correo VARCHAR(100),
FOREIGN KEY (correo) REFERENCES Usuario(correo)
);


-- Muestra cuantos cuentas (sucursales) tiene cada concesionario
SELECT u.correo,
COUNT(uc.id_cuenta) AS total_cuentas
FROM Usuario u
JOIN Usuario_Cuenta uc ON u.correo = uc.correo
GROUP BY u.correo
ORDER BY total_cuentas DESC;

-- Lista las sucursales asociadas a un concesionario especifico
SELECT u.correo, c.id_cuenta, c.razon_social, c.municipio, c.estado
FROM Usuario u
JOIN Usuario_Cuenta uc ON u.correo = uc.correo
JOIN Cuenta c ON uc.id_cuenta = c.id_cuenta
WHERE u.correo = 'conces1@empresa.com';

-- Muestra las reservas realizadas por un concesionario
SELECT folio, fecha, subtotal, iva, total
FROM Reserva
WHERE correo = 'conces1@empresa.com'
ORDER BY fecha DESC;

-- Muestra los productos incluidos dentro de una reserva especifica
SELECT  r.folio, p.nombre_comercial, rp.cantidad, rp.precio_aplicado, rp.subtotal_linea
FROM Reserva_Producto rp
JOIN Producto p ON rp.SKU = p.SKU
JOIN Reserva r ON rp.folio = r.folio
WHERE r.folio = 'R00064';

-- Calcula el total de ventas generadas por cada campaña
SELECT  c.nombre,
SUM(rp.subtotal_linea) AS ventas_totales
FROM Reserva_Producto rp
JOIN Producto p ON rp.SKU = p.SKU
JOIN Campania c ON p.id_campania = c.id_campania
GROUP BY c.nombre
ORDER BY ventas_totales DESC;

-- Muestra el total vendido por cada sucursal (cuenta)
SELECT c.razon_social,
SUM(r.total) AS total_ventas
FROM Reserva r
JOIN Cuenta c ON r.id_cuenta = c.id_cuenta
GROUP BY c.razon_social
ORDER BY total_ventas DESC;

-- Calcula la calificacion promedio de cada producto
SELECT p.nombre_comercial,
AVG(c.estrellas) AS calificacion_promedio
FROM Calificacion c
JOIN Producto p ON c.SKU = p.SKU
GROUP BY p.nombre_comercial
ORDER BY calificacion_promedio DESC;

-- Calcula el peso total que debe transportar logistica por campaña
SELECT c.nombre,
SUM(p.peso_unitario * rp.cantidad) AS peso_total_logistico
FROM Reserva_Producto rp
JOIN Producto p ON rp.SKU = p.SKU
JOIN Campania c ON p.id_campania = c.id_campania
GROUP BY c.nombre;

-- Muestra el historial de acciones registradas en la bitacora de auditoria
SELECT correo, accion, fecha
FROM BitacoraAuditoria
ORDER BY fecha DESC;

