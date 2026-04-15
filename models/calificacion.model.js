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
