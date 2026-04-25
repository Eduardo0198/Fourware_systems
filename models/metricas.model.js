const db = require('../config/db');

exports.obtenerCampaniasConReservas = () => new Promise((resolve, reject) => {
    const query = `
        SELECT DISTINCT
            c.id_campania,
            c.nombre
        FROM "Campania" c
        JOIN "Producto" p ON p.id_campania = c.id_campania
        JOIN "Reserva_Producto" rp ON rp."SKU" = p."SKU"
        JOIN "Reserva" r ON r.folio = rp.folio
        WHERE r.estatus = 1
        ORDER BY c.nombre
    `;
    db.query(query, (err, rows) => err ? reject(err) : resolve(rows));
});

exports.consultarRankingProductos = (filtros) => new Promise((resolve, reject) => {
    const { idCampania, fechaInicio, fechaFin, producto } = filtros;
    const params = [];

    let condiciones = `WHERE r.estatus = 1`;

    if (idCampania) {
        params.push(idCampania);
        condiciones += ` AND c.id_campania = ?`;
    }

    if (fechaInicio) {
        params.push(fechaInicio);
        condiciones += ` AND r.fecha >= ?`;
    }

    if (fechaFin) {
        params.push(fechaFin);
        condiciones += ` AND r.fecha <= ?`;
    }

    if (producto) {
        params.push(`%${producto}%`, `%${producto}%`);
        condiciones += ` AND (p."SKU" ILIKE ? OR p.nombre_comercial ILIKE ?)`;
    }

    const query = `
        WITH totales_campania AS (
            SELECT
                p2.id_campania,
                COUNT(DISTINCT r2.folio)    AS total_ordenes,
                SUM(r2.total)               AS monto_total
            FROM "Reserva" r2
            JOIN "Reserva_Producto" rp2 ON rp2.folio = r2.folio
            JOIN "Producto" p2           ON p2."SKU"  = rp2."SKU"
            WHERE r2.estatus = 1
            GROUP BY p2.id_campania
        )
        SELECT
            ROW_NUMBER() OVER (ORDER BY SUM(rp.cantidad) DESC) AS posicion,
            p."SKU",
            p.nombre_comercial,
            SUM(rp.cantidad)               AS total_unidades,
            c.nombre                       AS nombre_campania,
            tc.total_ordenes               AS total_ordenes_campania,
            tc.monto_total                 AS monto_total_campania
        FROM "Reserva_Producto" rp
        JOIN "Reserva"  r  ON r.folio        = rp.folio
        JOIN "Producto" p  ON p."SKU"        = rp."SKU"
        JOIN "Campania" c  ON c.id_campania  = p.id_campania
        JOIN totales_campania tc ON tc.id_campania = p.id_campania
        ${condiciones}
        GROUP BY p."SKU", p.nombre_comercial, c.nombre, tc.total_ordenes, tc.monto_total
        ORDER BY total_unidades DESC
    `;

    db.query(query, params, (err, rows) => err ? reject(err) : resolve(rows));
});

exports.consultarRankingGeografico = (filtros) => new Promise((resolve, reject) => {
    const { idCampania, fechaInicio, fechaFin } = filtros;
    const params = [];

    let condiciones = `WHERE r.estatus = 1`;

    if (idCampania) {
        params.push(idCampania);
        condiciones += ` AND ca.id_campania = ?`;
    }
    if (fechaInicio) {
        params.push(fechaInicio);
        condiciones += ` AND r.fecha >= ?`;
    }
    if (fechaFin) {
        params.push(fechaFin);
        condiciones += ` AND r.fecha <= ?`;
    }

    const query = `
        SELECT
            s.estado,
            p."SKU",
            p.nombre_comercial,
            rp.cantidad
        FROM "Reserva_Producto" rp
        JOIN "Reserva"  r  ON r.folio        = rp.folio
        JOIN "Producto" p  ON p."SKU"        = rp."SKU"
        JOIN "Campania" ca ON ca.id_campania = p.id_campania
        LEFT JOIN "Sucursal" s ON s.id_sucursal = r.id_sucursal
        ${condiciones}
    `;

    db.query(query, params, (err, rows) => err ? reject(err) : resolve(rows));
});

exports.consultarDatos = (filtros) =>
    Promise.all([
        exports.consultarRankingProductos(filtros),
        exports.consultarMetricasComparativas(filtros),
        exports.consultarRankingGeografico(filtros)
            .then((rows) => { require('../utils/logger').info('geo rows:', rows.length); return rows; })
            .catch((err) => { require('../utils/logger').error('consultarRankingGeografico error:', err.message, err.stack); return []; })
    ]).then(([ranking, metricas, geografico]) => ({ ranking, metricas, geografico }));

exports.consultarMetricasComparativas = (filtros) => new Promise((resolve, reject) => {
    const { idCampania, fechaInicio, fechaFin } = filtros;
    const params = [];

    let condiciones = `WHERE r.estatus = 1`;

    if (idCampania) {
        params.push(idCampania);
        condiciones += ` AND c.id_campania = ?`;
    }

    if (fechaInicio) {
        params.push(fechaInicio);
        condiciones += ` AND r.fecha >= ?`;
    }

    if (fechaFin) {
        params.push(fechaFin);
        condiciones += ` AND r.fecha <= ?`;
    }

    const query = `
        SELECT
            c.nombre                    AS nombre_campania,
            COUNT(DISTINCT r.folio)     AS total_ordenes,
            SUM(r.total)                AS monto_total
        FROM "Reserva" r
        JOIN "Reserva_Producto" rp ON rp.folio     = r.folio
        JOIN "Producto" p          ON p."SKU"       = rp."SKU"
        JOIN "Campania" c          ON c.id_campania = p.id_campania
        ${condiciones}
        GROUP BY c.id_campania, c.nombre
        ORDER BY c.nombre
    `;

    db.query(query, params, (err, rows) => err ? reject(err) : resolve(rows));
});
