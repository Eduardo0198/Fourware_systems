const db = require('../config/db');

exports.listarProductosCatalogo = (callback) => {
    const query = `
        SELECT
            p.SKU,
            p.nombre_comercial,
            p.descripcion,
            p.precio_unitario,
            p.peso_unitario,
            p.volumen_unitario,
            p.medida_primaria,
            p.unidad_venta,
            p.imagen,
            p.activo,
            p.id_campania,
            c.nombre AS nombre_campania
        FROM Producto p
        LEFT JOIN Campania c ON c.id_campania = p.id_campania
        ORDER BY p.SKU ASC
    `;

    db.query(query, callback);
};

exports.obtenerPorSku = (sku, callback) => {
    const query = `
        SELECT *
        FROM Producto
        WHERE SKU = ?
        LIMIT 1
    `;

    db.query(query, [sku], (err, rows) => {
        if (err) {
            return callback(err);
        }

        callback(null, rows.length ? rows[0] : null);
    });
};

// recibe un arreglo de SKUs y 
// devuelve un arreglo con los SKUs que existen en la base de datos
exports.obtenerPorSkus = (skus, callback) => {
    if (!Array.isArray(skus) || skus.length === 0) {
        return callback(null, []);
    }
    // se construye una consulta con tantos placeholders como SKUs se recibieron
    const placeholders = skus.map(() => '?').join(', ');
    const query = `
        SELECT SKU
        FROM Producto
        WHERE SKU IN (${placeholders})
    `;

    db.query(query, skus, callback);
};



exports.registrar = (producto, callback) => {
    const query = `
        INSERT INTO Producto (
            SKU,
            nombre_comercial,
            descripcion,
            precio_unitario,
            peso_unitario,
            volumen_unitario,
            medida_primaria,
            unidad_venta,
            imagen,
            activo,
            id_campania
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(query, [
        producto.sku,
        producto.nombre_comercial,
        producto.descripcion,
        producto.precio_unitario,
        producto.peso_unitario,
        producto.volumen_unitario,
        producto.medida_primaria,
        producto.unidad_venta,
        producto.imagen,
        producto.activo,
        producto.id_campania
    ], callback);
};

exports.registrarMultiples = (productos, callback) => {
    if (!Array.isArray(productos) || productos.length === 0) {
        return callback(null, { affectedRows: 0 });
    }

    const values = productos.map((producto) => ([
        producto.sku,
        producto.nombre_comercial,
        producto.descripcion,
        producto.precio_unitario,
        producto.peso_unitario,
        producto.volumen_unitario,
        producto.medida_primaria,
        producto.unidad_venta,
        producto.imagen,
        producto.activo,
        producto.id_campania
    ]));

    const query = `
        INSERT INTO Producto (
            SKU,
            nombre_comercial,
            descripcion,
            precio_unitario,
            peso_unitario,
            volumen_unitario,
            medida_primaria,
            unidad_venta,
            imagen,
            activo,
            id_campania
        )
        VALUES ?
    `;

    db.query(query, [values], callback);
};

exports.actualizarPorSku = (sku, producto, callback) => {
    const query = `
        UPDATE Producto
        SET
            nombre_comercial = ?,
            descripcion = ?,
            precio_unitario = ?,
            peso_unitario = ?,
            volumen_unitario = ?,
            medida_primaria = ?,
            unidad_venta = ?,
            imagen = ?,
            id_campania = ?
        WHERE SKU = ?
    `;

    db.query(query, [
        producto.nombre_comercial,
        producto.descripcion,
        producto.precio_unitario,
        producto.peso_unitario,
        producto.volumen_unitario,
        producto.medida_primaria,
        producto.unidad_venta,
        producto.imagen,
        producto.id_campania,
        sku
    ], callback);
};
