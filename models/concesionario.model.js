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

// Obtener productos con paginación y filtros
exports.obtenerProductosPaginados = (page, limit, searchTerm, precioMin, precioMax, unidadVenta, callback) => {
    const offset = (page - 1) * limit;
    let query = `
        SELECT SKU, nombre_comercial AS nombre, precio_unitario, peso_unitario, medida_primaria, imagen
        FROM Producto
        WHERE 1=1
    `;
    const params = [];

    if (searchTerm) {
        query += ` AND nombre_comercial LIKE ?`;
        params.push(`%${searchTerm}%`);
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

        // Consulta para contar total con los mismos filtros
        let countQuery = `SELECT COUNT(*) AS total FROM Producto WHERE 1=1`;
        const countParams = [];

        if (searchTerm) {
            countQuery += ` AND nombre_comercial LIKE ?`;
            countParams.push(`%${searchTerm}%`);
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

// Obtener unidades de venta únicas para el filtro
exports.obtenerUnidadesVenta = (callback) => {
    const query = `
        SELECT DISTINCT unidad_venta
        FROM Producto
        WHERE unidad_venta IS NOT NULL AND unidad_venta != ''
        ORDER BY unidad_venta
    `;
    db.query(query, (err, results) => {
        if (err) return callback(err);
        const unidades = results.map(row => row.unidad_venta);
        callback(null, unidades);
    });
};

exports.obtenerProductoPorSku = (sku, callback) => {
    const query = `
        SELECT SKU, nombre_comercial AS nombre, precio_unitario, peso_unitario, 
               medida_primaria, imagen, descripcion, unidad_venta, volumen_unitario
        FROM Producto
        WHERE SKU = ?
    `;
    db.query(query, [sku], (err, results) => {
        if (err) return callback(err);
        callback(null, results[0] || null);
    });
};