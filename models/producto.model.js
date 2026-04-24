const db = require('../config/db');

exports.listarProductosCatalogo = (callback) => {
    const query = `
        SELECT
            p."SKU",
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
        FROM "Producto" p
        LEFT JOIN "Campania" c ON c.id_campania = p.id_campania
        ORDER BY
            CASE WHEN p.imagen ILIKE 'https://%' OR p.imagen ILIKE '/img/ImagenesPintura/%' THEN 0 ELSE 1 END ASC,
            p."SKU" ASC
    `;

    db.query(query, callback);
};

exports.obtenerPorSku = (sku, callback) => {
    const query = `
        SELECT *
        FROM "Producto"
        WHERE "SKU" = ?
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
    const placeholders = skus.map(() => '?').join(', ');
    const query = `
        SELECT "SKU"
        FROM "Producto"
        WHERE "SKU" IN (${placeholders})
    `;

    db.query(query, skus, callback);
};

exports.registrar = (producto, callback) => {
    const query = `
        INSERT INTO "Producto" (
            "SKU",
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
        const emptyResult = [];
        emptyResult.affectedRows = 0;
        return callback(null, emptyResult);
    }

    const cols = 11;
    const placeholders = productos.map((_, i) =>
        `(${Array.from({ length: cols }, (__, j) => `$${i * cols + j + 1}`).join(', ')})`
    ).join(', ');

    const values = productos.flatMap(p => [
        p.sku,
        p.nombre_comercial,
        p.descripcion,
        p.precio_unitario,
        p.peso_unitario,
        p.volumen_unitario,
        p.medida_primaria,
        p.unidad_venta,
        p.imagen,
        p.activo,
        p.id_campania
    ]);

    const query = `
        INSERT INTO "Producto" (
            "SKU",
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
        VALUES ${placeholders}
    `;

    db.query(query, values, callback);
};

exports.actualizarPorSku = (sku, producto, callback) => {
    const query = `
        UPDATE "Producto"
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
        WHERE "SKU" = ?
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

exports.actualizarEstado = (sku, nuevoEstado, callback) => {
    const query = `
        UPDATE "Producto"
        SET activo = ?
        WHERE "SKU" = ?
    `;

    db.query(query, [nuevoEstado, sku], callback);
};

exports.contarHistorialPorSku = (sku, callback) => {
    const query = `
        SELECT
            (
                SELECT COUNT(*)
                FROM "Reserva_Producto"
                WHERE "SKU" = ?
            ) AS total_reservas,
            (
                SELECT COUNT(*)
                FROM "Calificacion"
                WHERE "SKU" = ?
            ) AS total_calificaciones
    `;

    db.query(query, [sku, sku], (err, rows) => {
        if (err) {
            return callback(err);
        }

        const resumen = rows && rows.length ? rows[0] : {};
        const totalReservas = Number(resumen.total_reservas || 0);
        const totalCalificaciones = Number(resumen.total_calificaciones || 0);

        callback(null, {
            totalReservas,
            totalCalificaciones,
            total: totalReservas + totalCalificaciones
        });
    });
};

exports.retirarDelCatalogo = (sku, callback) => {
    const query = `
        UPDATE "Producto"
        SET activo = 0
        WHERE "SKU" = ?
    `;

    db.query(query, [sku], callback);
};

exports.eliminarPorSku = (sku, callback) => {
    const query = `
        DELETE FROM "Producto"
        WHERE "SKU" = ?
    `;

    db.query(query, [sku], callback);
};

exports.contarProductos = (callback) => {
    db.query(`SELECT COUNT(*) AS total FROM "Producto"`, callback);
};
