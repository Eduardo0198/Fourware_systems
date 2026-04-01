const db = require('../config/db');

exports.obtenerTopProductos = (callback) => {
    const query = `
        SELECT p.nombre_comercial, COUNT(r.SKU) AS total
        FROM Producto p
        JOIN Reserva_Producto r ON p.SKU = r.SKU
        GROUP BY p.nombre_comercial
        ORDER BY total DESC
        LIMIT 5
    `;
    db.query(query, callback);
};

// Obtener productos con paginación y filtros del catálogo de la campaña activa
exports.obtenerProductosPaginados = (
    page,
    limit,
    searchTerm,
    precioMin,
    precioMax,
    unidadVenta,
    idCampania,
    callback
) => {
    const offset = (page - 1) * limit;
    let query = `
        SELECT
            SKU,
            nombre_comercial AS nombre,
            descripcion,
            precio_unitario,
            peso_unitario,
            volumen_unitario,
            medida_primaria,
            imagen
        FROM Producto
        WHERE activo = 1
          AND id_campania = ?
    `;
    const params = [idCampania];

    if (searchTerm) {
        query += ` AND (
            SKU LIKE ?
            OR nombre_comercial LIKE ?
            OR descripcion LIKE ?
        )`;
        params.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
    }

    if (precioMin !== undefined && precioMin !== null && !isNaN(precioMin)) {
        query += ` AND precio_unitario >= ?`;
        params.push(parseFloat(precioMin));
    }

    if (precioMax !== undefined && precioMax !== null && !isNaN(precioMax)) {
        query += ` AND precio_unitario <= ?`;
        params.push(parseFloat(precioMax));
    }

    if (unidadVenta && unidadVenta !== '') {
        query += ` AND unidad_venta = ?`;
        params.push(unidadVenta);
    }

    query += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    db.query(query, params, (err, productos) => {
        if (err) return callback(err);

        let countQuery = `
            SELECT COUNT(*) AS total
            FROM Producto
            WHERE activo = 1
              AND id_campania = ?
        `;
        const countParams = [idCampania];

        if (searchTerm) {
            countQuery += ` AND (
                SKU LIKE ?
                OR nombre_comercial LIKE ?
                OR descripcion LIKE ?
            )`;
            countParams.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
        }

        if (precioMin !== undefined && precioMin !== null && !isNaN(precioMin)) {
            countQuery += ` AND precio_unitario >= ?`;
            countParams.push(parseFloat(precioMin));
        }

        if (precioMax !== undefined && precioMax !== null && !isNaN(precioMax)) {
            countQuery += ` AND precio_unitario <= ?`;
            countParams.push(parseFloat(precioMax));
        }

        if (unidadVenta && unidadVenta !== '') {
            countQuery += ` AND unidad_venta = ?`;
            countParams.push(unidadVenta);
        }

        db.query(countQuery, countParams, (err, countResult) => {
            if (err) return callback(err);
            const total = countResult[0].total;
            callback(null, { productos, total });
        });
    });
};

// Obtener unidades de venta únicas de la campaña activa
exports.obtenerUnidadesVenta = (idCampania, callback) => {
    const query = `
        SELECT DISTINCT unidad_venta
        FROM Producto
        WHERE activo = 1
          AND id_campania = ?
          AND unidad_venta IS NOT NULL
          AND unidad_venta != ''
        ORDER BY unidad_venta
    `;
    db.query(query, [idCampania], (err, results) => {
        if (err) return callback(err);
        const unidades = results.map(row => row.unidad_venta);
        callback(null, unidades);
    });
};

exports.obtenerProductoPorSku = (sku, callback) => {
    const query = `
        SELECT SKU, nombre_comercial AS nombre, precio_unitario, peso_unitario, 
               medida_primaria, imagen, descripcion, unidad_venta, volumen_unitario, activo, id_campania
        FROM Producto
        WHERE SKU = ?
    `;
    db.query(query, [sku], (err, results) => {
        if (err) return callback(err);
        callback(null, results[0] || null);
    });
};

exports.obtenerProductoActivoPorSkuYCampania = (sku, idCampania, callback) => {
    const query = `
        SELECT
            SKU,
            nombre_comercial AS nombre,
            precio_unitario,
            peso_unitario,
            medida_primaria,
            imagen,
            descripcion,
            unidad_venta,
            volumen_unitario,
            activo,
            id_campania
        FROM Producto
        WHERE SKU = ?
          AND activo = 1
          AND id_campania = ?
        LIMIT 1
    `;

    db.query(query, [sku, idCampania], (err, results) => {
        if (err) return callback(err);
        callback(null, results[0] || null);
    });
};
