const db = require('../config/db');

exports.obtenerTopProductos = (callback) => {
    const query = `
        SELECT
            p."SKU",
            p.nombre_comercial,
            p.imagen,
            COUNT(r."SKU") AS total,
            COALESCE(cal.promedio_estrellas, 0) AS promedio_estrellas,
            COALESCE(cal.total_resenas, 0) AS total_resenas
        FROM "Producto" p
        JOIN "Reserva_Producto" r ON p."SKU" = r."SKU"
        LEFT JOIN (
            SELECT
                "SKU",
                ROUND(AVG(estrellas)::numeric, 1) AS promedio_estrellas,
                COUNT(*) AS total_resenas
            FROM "Calificacion"
            GROUP BY "SKU"
        ) cal ON cal."SKU" = p."SKU"
        GROUP BY p."SKU", p.nombre_comercial, p.imagen, cal.promedio_estrellas, cal.total_resenas
        ORDER BY total DESC
        LIMIT 5
    `;
    db.query(query, callback);
};

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
            p."SKU",
            p.nombre_comercial AS nombre,
            p.descripcion,
            p.precio_unitario,
            p.peso_unitario,
            p.volumen_unitario,
            p.medida_primaria,
            p.imagen,
            COALESCE(cal.promedio_estrellas, 0) AS promedio_estrellas,
            COALESCE(cal.total_resenas, 0) AS total_resenas
        FROM "Producto" p
        LEFT JOIN (
            SELECT
                "SKU",
                ROUND(AVG(estrellas)::numeric, 1) AS promedio_estrellas,
                COUNT(*) AS total_resenas
            FROM "Calificacion"
            GROUP BY "SKU"
        ) cal ON cal."SKU" = p."SKU"
        WHERE p.activo = 1
          AND p.id_campania = CAST(? AS integer)
    `;
    const params = [idCampania];

    if (searchTerm) {
        query += ` AND (
            p."SKU" ILIKE CAST(? AS text)
            OR p.nombre_comercial ILIKE CAST(? AS text)
            OR p.descripcion ILIKE CAST(? AS text)
        )`;
        params.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
    }

    if (precioMin !== undefined && precioMin !== null && !isNaN(precioMin)) {
        query += ` AND p.precio_unitario >= CAST(? AS numeric)`;
        params.push(parseFloat(precioMin));
    }

    if (precioMax !== undefined && precioMax !== null && !isNaN(precioMax)) {
        query += ` AND p.precio_unitario <= CAST(? AS numeric)`;
        params.push(parseFloat(precioMax));
    }

    if (unidadVenta && unidadVenta !== '') {
        query += ` AND p.unidad_venta = CAST(? AS text)`;
        params.push(unidadVenta);
    }

    query += ` ORDER BY
        CASE WHEN p.imagen ILIKE 'https://%' OR p.imagen ILIKE '/img/ImagenesPintura/%' THEN 0 ELSE 1 END ASC,
        p."SKU" ASC
        LIMIT CAST(? AS integer) OFFSET CAST(? AS integer)`;
    params.push(limit, offset);

    db.query(query, params, (err, productos) => {
        if (err) return callback(err);

        let countQuery = `
            SELECT COUNT(*) AS total
            FROM "Producto"
            WHERE activo = 1
              AND id_campania = CAST(? AS integer)
        `;
        const countParams = [idCampania];

        if (searchTerm) {
            countQuery += ` AND (
                "SKU" ILIKE CAST(? AS text)
                OR nombre_comercial ILIKE CAST(? AS text)
                OR descripcion ILIKE CAST(? AS text)
            )`;
            countParams.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
        }

        if (precioMin !== undefined && precioMin !== null && !isNaN(precioMin)) {
            countQuery += ` AND precio_unitario >= CAST(? AS numeric)`;
            countParams.push(parseFloat(precioMin));
        }

        if (precioMax !== undefined && precioMax !== null && !isNaN(precioMax)) {
            countQuery += ` AND precio_unitario <= CAST(? AS numeric)`;
            countParams.push(parseFloat(precioMax));
        }

        if (unidadVenta && unidadVenta !== '') {
            countQuery += ` AND unidad_venta = CAST(? AS text)`;
            countParams.push(unidadVenta);
        }

        db.query(countQuery, countParams, (err2, countResult) => {
            if (err2) return callback(err2);
            const total = Number(countResult[0].total);
            callback(null, { productos, total });
        });
    });
};

exports.obtenerUnidadesVenta = (idCampania, callback) => {
    const query = `
        SELECT DISTINCT unidad_venta
        FROM "Producto"
        WHERE activo = 1
          AND id_campania = CAST(? AS integer)
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
        SELECT "SKU", nombre_comercial AS nombre, precio_unitario, peso_unitario,
               medida_primaria, imagen, descripcion, unidad_venta, volumen_unitario, activo, id_campania
        FROM "Producto"
        WHERE "SKU" = CAST(? AS text)
    `;
    db.query(query, [sku], (err, results) => {
        if (err) return callback(err);
        callback(null, results[0] || null);
    });
};

exports.obtenerProductoActivoPorSkuYCampania = (sku, idCampania, callback) => {
    const query = `
        SELECT
            "SKU",
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
        FROM "Producto"
        WHERE "SKU" = CAST(? AS text)
          AND activo = 1
          AND id_campania = CAST(? AS integer)
        LIMIT 1
    `;

    db.query(query, [sku, idCampania], (err, results) => {
        if (err) return callback(err);
        callback(null, results[0] || null);
    });
};
