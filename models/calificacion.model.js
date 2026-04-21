const db = require('../config/db');

exports.registrarCalificacion = (correo, sku, calificacion, comentario, callback) => {
    const query = `
        INSERT INTO "Calificacion" (correo, "SKU", estrellas, comentario, fecha)
        VALUES (?, ?, ?, ?, NOW())
    `;
    db.query(query, [correo, sku, calificacion, comentario], callback);
};

exports.obtenerResumenCalificacionesPorSku = (sku, callback) => {
    const query = `
        SELECT
            COUNT(*) AS total_resenas,
            ROUND(AVG(estrellas)::numeric, 1) AS promedio_general,
            SUM(CASE WHEN estrellas = 5 THEN 1 ELSE 0 END) AS cinco_estrellas,
            SUM(CASE WHEN estrellas = 4 THEN 1 ELSE 0 END) AS cuatro_estrellas,
            SUM(CASE WHEN estrellas = 3 THEN 1 ELSE 0 END) AS tres_estrellas,
            SUM(CASE WHEN estrellas = 2 THEN 1 ELSE 0 END) AS dos_estrellas,
            SUM(CASE WHEN estrellas = 1 THEN 1 ELSE 0 END) AS una_estrella
        FROM "Calificacion"
        WHERE "SKU" = ?
    `;

    db.query(query, [sku], (err, rows) => {
        if (err) {
            return callback(err);
        }

        const resumen = rows[0] || {};
        callback(null, {
            total_resenas: Number(resumen.total_resenas || 0),
            promedio_general: Number(resumen.promedio_general || 0),
            distribucion: {
                5: Number(resumen.cinco_estrellas || 0),
                4: Number(resumen.cuatro_estrellas || 0),
                3: Number(resumen.tres_estrellas || 0),
                2: Number(resumen.dos_estrellas || 0),
                1: Number(resumen.una_estrella || 0)
            }
        });
    });
};

exports.obtenerResenasPorSku = (sku, callback) => {
    const query = `
        SELECT
            c.id_calificacion,
            c.estrellas,
            c.comentario,
            c.fecha,
            c.correo,
            u.nombre
        FROM "Calificacion" c
        LEFT JOIN "Usuario" u ON u.correo = c.correo
        WHERE c."SKU" = ?
        ORDER BY c.fecha DESC, c.id_calificacion DESC
        LIMIT 8
    `;

    db.query(query, [sku], callback);
};

exports.consultarResultadosMarketingPorNombre = (nombre, callback) => {
    const query = `
        SELECT
            p."SKU",
            p.nombre_comercial,
            cp.nombre AS campania,
            COUNT(c.id_calificacion)::int AS total_calificaciones,
            COUNT(*) FILTER (WHERE TRIM(COALESCE(c.comentario, '')) <> '')::int AS total_comentarios,
            ROUND(AVG(c.estrellas)::numeric, 1) AS promedio_estrellas,
            CASE
                WHEN COUNT(c.id_calificacion) = 0 THEN 'No existen comentarios ni calificaciones.'
                WHEN COUNT(*) FILTER (WHERE TRIM(COALESCE(c.comentario, '')) <> '') = 0 THEN 'No existen comentarios.'
                ELSE NULL
            END AS mensaje_estado,
            COALESCE(
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'estrellas', c.estrellas,
                        'comentario', c.comentario,
                        'correo', c.correo,
                        'fecha', c.fecha
                    )
                    ORDER BY c.fecha DESC, c.id_calificacion DESC
                ) FILTER (WHERE TRIM(COALESCE(c.comentario, '')) <> ''),
                '[]'::json
            ) AS comentarios
        FROM "Producto" p
        INNER JOIN "Campania" cp ON cp.id_campania = p.id_campania
        LEFT JOIN "Calificacion" c ON c."SKU" = p."SKU"
        WHERE UPPER(p.nombre_comercial) LIKE UPPER(?)
        GROUP BY p."SKU", p.nombre_comercial, cp.nombre
        ORDER BY p.nombre_comercial ASC, p."SKU" ASC
    `;

    db.query(query, [`%${nombre}%`], callback);
};

exports.obtenerPromedioCalificacionesPorCampaniaActiva = (callback) => {
    const query = `
        SELECT
            cp.id_campania,
            cp.nombre AS campania,
            COUNT(c.id_calificacion)::int AS total_calificaciones,
            ROUND(COALESCE(AVG(c.estrellas), 0)::numeric, 1) AS promedio_estrellas
        FROM "Campania" cp
        LEFT JOIN "Producto" p ON p.id_campania = cp.id_campania
        LEFT JOIN "Calificacion" c ON c."SKU" = p."SKU"
        WHERE cp.estatus = 1
        GROUP BY cp.id_campania, cp.nombre
        ORDER BY cp.nombre ASC, cp.id_campania ASC
    `;

    db.query(query, callback);
};
