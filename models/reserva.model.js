const db = require('../config/db');

exports.obtenerResumenPorCorreoYCuenta = (correo, idCuenta, callback) => {
    const query = `
        SELECT
            COUNT(*) AS total_reservas,
            SUM(CASE WHEN estatus = 1 THEN 1 ELSE 0 END) AS reservas_confirmadas,
            SUM(CASE WHEN estatus = 0 THEN 1 ELSE 0 END) AS reservas_canceladas,
            MAX(fecha) AS ultima_reserva_fecha
        FROM "Reserva"
        WHERE correo = ?
          AND id_cuenta = ?
    `;

    db.query(query, [correo, idCuenta], (err, rows) => {
        if (err) {
            return callback(err);
        }

        return callback(null, rows[0] || {
            total_reservas: 0,
            reservas_confirmadas: 0,
            reservas_canceladas: 0,
            ultima_reserva_fecha: null
        });
    });
};

exports.obtenerReservasRecientesPorCorreoYCuenta = (correo, idCuenta, limite, callback) => {
    const query = `
        SELECT
            r.folio,
            r.estatus,
            r.fecha,
            r.total,
            r.fecha_cancelacion_reserva,
            s.nombre AS nombre_sucursal
        FROM "Reserva" r
        LEFT JOIN "Sucursal" s ON s.id_sucursal = r.id_sucursal
        WHERE r.correo = ?
          AND r.id_cuenta = ?
        ORDER BY r.fecha DESC, r.fecha_cancelacion_reserva DESC
        LIMIT ?
    `;

    db.query(query, [correo, idCuenta, Number(limite) || 5], callback);
};

exports.obtenerReservasPorCorreoYCuenta = (correo, idCuenta, callback) => {
    const query = `
        SELECT
            r.folio,
            r.estatus,
            r.fecha,
            r.subtotal,
            r.iva,
            r.total,
            r.fecha_cancelacion_reserva,
            r.correo,
            r.id_cuenta,
            r.id_sucursal,
            s.nombre AS nombre_sucursal
        FROM "Reserva" r
        LEFT JOIN "Sucursal" s ON s.id_sucursal = r.id_sucursal
        WHERE r.correo = ?
          AND r.id_cuenta = ?
        ORDER BY r.fecha DESC, r.fecha_cancelacion_reserva DESC
    `;

    db.query(query, [correo, idCuenta], callback);
};

exports.obtenerDetallePorFolioCorreoYCuenta = (folio, correo, idCuenta, callback) => {
    const reservaQuery = `
        SELECT
            r.folio,
            r.estatus,
            r.fecha,
            r.subtotal,
            r.iva,
            r.total,
            r.fecha_cancelacion_reserva,
            r.correo,
            r.id_cuenta,
            r.id_sucursal,
            s.nombre AS nombre_sucursal,
            s.direccion,
            s.municipio,
            s.estado
        FROM "Reserva" r
        LEFT JOIN "Sucursal" s ON s.id_sucursal = r.id_sucursal
        WHERE r.folio = ?
          AND r.correo = ?
          AND r.id_cuenta = ?
        LIMIT 1
    `;

    db.query(reservaQuery, [folio, correo, idCuenta], (reservaErr, reservaRows) => {
        if (reservaErr) {
            return callback(reservaErr);
        }

        if (!Array.isArray(reservaRows) || reservaRows.length === 0) {
            return callback(null, null);
        }

        const detalleQuery = `
            SELECT
                rp.folio,
                rp."SKU",
                rp.cantidad,
                rp.precio_aplicado,
                rp.subtotal_linea,
                p.nombre_comercial,
                p.imagen,
                p.medida_primaria
            FROM "Reserva_Producto" rp
            LEFT JOIN "Producto" p ON p."SKU" = rp."SKU"
            WHERE rp.folio = ?
            ORDER BY rp."SKU" ASC
        `;

        db.query(detalleQuery, [folio], (detalleErr, detalleRows) => {
            if (detalleErr) {
                return callback(detalleErr);
            }

            callback(null, {
                ...reservaRows[0],
                productos: Array.isArray(detalleRows) ? detalleRows : []
            });
        });
    });
};

exports.cancelarReserva = (folio, correo, idCuenta, callback) => {
    const query = `
        UPDATE "Reserva"
        SET estatus = 0
        WHERE folio = ?
          AND correo = ?
          AND id_cuenta = ?
          AND estatus = 1
    `;

    db.query(query, [folio, correo, idCuenta], callback);
};

exports.obtenerReservasConfirmadasPorPeriodo = (fechaInicio, fechaFin, callback) => {
    const query = `
        SELECT
            r.folio,
            r.fecha,
            r.estatus,
            r.subtotal,
            r.iva,
            r.total,
            c.nombre AS cuenta,
            u.nombre AS distribuidor,
            u.correo,
            ROUND(COALESCE(SUM(rp.cantidad * p.peso_unitario), 0), 2) AS peso_total,
            ROUND(COALESCE(SUM(rp.cantidad * p.volumen_unitario), 0), 2) AS volumen_total,
            STRING_AGG(DISTINCT ca.nombre, ', ') AS campanias
        FROM "Reserva" r
        JOIN "Cuenta" c ON c.id_cuenta = r.id_cuenta
        JOIN "Usuario" u ON u.correo = r.correo
        LEFT JOIN "Reserva_Producto" rp ON rp.folio = r.folio
        LEFT JOIN "Producto" p ON p."SKU" = rp."SKU"
        LEFT JOIN "Campania" ca ON ca.id_campania = p.id_campania
        WHERE r.estatus = 1
          AND r.fecha BETWEEN ? AND ?
        GROUP BY
            r.folio,
            r.fecha,
            r.estatus,
            r.subtotal,
            r.iva,
            r.total,
            c.nombre,
            u.nombre,
            u.correo
        ORDER BY r.fecha DESC, r.fecha_cancelacion_reserva DESC
    `;

    db.query(query, [fechaInicio, fechaFin], callback);
};

exports.obtenerMetricasLogisticasConsolidadas = (filtros, callback) => {
    const agruparPorCuenta = filtros.agruparPor === 'cuenta';

    const campoId = agruparPorCuenta
        ? 'c.id_cuenta'
        : 'ca.id_campania';

    const campoNombre = agruparPorCuenta
        ? 'c.nombre'
        : 'ca.nombre';

    const condiciones = [
        'r.estatus = 1',
        'r.fecha BETWEEN ? AND ?'
    ];

    const params = [filtros.fechaInicio, filtros.fechaFin];

    if (filtros.idCuenta) {
        condiciones.push('r.id_cuenta = ?');
        params.push(filtros.idCuenta);
    }

    if (filtros.idCampania) {
        condiciones.push('p.id_campania = ?');
        params.push(filtros.idCampania);
    }

    const query = `
        SELECT
            ${campoId} AS id_agrupacion,
            COALESCE(${campoNombre}, 'Sin campania') AS agrupacion,
            COUNT(DISTINCT r.folio) AS total_reservas,
            COALESCE(SUM(rp.cantidad), 0) AS total_productos,
            ROUND(COALESCE(SUM(rp.cantidad * p.peso_unitario), 0), 2) AS peso_total,
            ROUND(COALESCE(SUM(rp.cantidad * p.volumen_unitario), 0), 2) AS volumen_total,
            ROUND(COALESCE(SUM(rp.subtotal_linea), 0), 2) AS importe_productos
        FROM "Reserva" r
        JOIN "Cuenta" c ON c.id_cuenta = r.id_cuenta
        JOIN "Reserva_Producto" rp ON rp.folio = r.folio
        JOIN "Producto" p ON p."SKU" = rp."SKU"
        LEFT JOIN "Campania" ca ON ca.id_campania = p.id_campania
        WHERE ${condiciones.join('\n          AND ')}
        GROUP BY ${campoId}, ${campoNombre}
        ORDER BY peso_total DESC, volumen_total DESC, agrupacion ASC
    `;

    db.query(query, params, callback);
};

exports.obtenerSerieTiempoMetricasLogisticas = (filtros, callback) => {
    const condiciones = [
        'r.estatus = 1',
        'r.fecha BETWEEN ? AND ?'
    ];
    const params = [filtros.fechaInicio, filtros.fechaFin];

    if (filtros.idCuenta) {
        condiciones.push('r.id_cuenta = ?');
        params.push(filtros.idCuenta);
    }

    if (filtros.idCampania) {
        condiciones.push('p.id_campania = ?');
        params.push(filtros.idCampania);
    }

    const query = `
        SELECT
            DATE(r.fecha) AS fecha,
            COUNT(DISTINCT r.folio) AS total_reservas,
            COALESCE(SUM(rp.cantidad), 0) AS total_productos,
            ROUND(COALESCE(SUM(rp.cantidad * p.peso_unitario), 0), 2) AS peso_total,
            ROUND(COALESCE(SUM(rp.cantidad * p.volumen_unitario), 0), 2) AS volumen_total
        FROM "Reserva" r
        JOIN "Reserva_Producto" rp ON rp.folio = r.folio
        JOIN "Producto" p ON p."SKU" = rp."SKU"
        WHERE ${condiciones.join('\n          AND ')}
        GROUP BY DATE(r.fecha)
        ORDER BY fecha ASC
    `;

    db.query(query, params, callback);
};


exports.obtenerReservasConfirmadasConFiltros = (filtros, callback) => {
    const condiciones = [
        'r.estatus = 1',
        'r.fecha BETWEEN ? AND ?'
    ];
    const params = [filtros.fechaInicio, filtros.fechaFin];

    if (filtros.idCuenta) {
        condiciones.push('r.id_cuenta = ?');
        params.push(filtros.idCuenta);
    }

    if (filtros.correo) {
        condiciones.push('r.correo = ?');
        params.push(filtros.correo);
    }

    if (filtros.idCampania) {
        condiciones.push(`
            EXISTS (
                SELECT 1
                FROM "Reserva_Producto" rp_filtro
                JOIN "Producto" p_filtro ON p_filtro."SKU" = rp_filtro."SKU"
                WHERE rp_filtro.folio = r.folio
                  AND p_filtro.id_campania = ?
            )
        `);
        params.push(filtros.idCampania);
    }

    const query = `
        SELECT
            r.folio,
            r.fecha,
            r.estatus,
            r.subtotal,
            r.iva,
            r.total,
            c.nombre AS cuenta,
            u.nombre AS distribuidor,
            u.correo,
            ROUND(COALESCE(SUM(rp.cantidad * p.peso_unitario), 0), 2) AS peso_total,
            ROUND(COALESCE(SUM(rp.cantidad * p.volumen_unitario), 0), 2) AS volumen_total,
            STRING_AGG(DISTINCT ca.nombre, ', ') AS campanias
        FROM "Reserva" r
        JOIN "Cuenta" c ON c.id_cuenta = r.id_cuenta
        JOIN "Usuario" u ON u.correo = r.correo
        LEFT JOIN "Reserva_Producto" rp ON rp.folio = r.folio
        LEFT JOIN "Producto" p ON p."SKU" = rp."SKU"
        LEFT JOIN "Campania" ca ON ca.id_campania = p.id_campania
        WHERE ${condiciones.join('\n          AND ')}
        GROUP BY
            r.folio,
            r.fecha,
            r.estatus,
            r.subtotal,
            r.iva,
            r.total,
            c.nombre,
            u.nombre,
            u.correo
        ORDER BY r.fecha DESC, r.fecha_cancelacion_reserva DESC
    `;

    db.query(query, params, callback);
};

// lau inicio modelo reporte operativo
exports.obtenerReporteOperativoLogistico = (filtros, callback) => {
    // aqui guardo las condiciones basicas para solo traer reservas confirmadas del rango pedido
    const condiciones = [
        'r.estatus = 1',
        'r.fecha BETWEEN ? AND ?'
    ];

    // aqui mando primero las fechas porque siempre se usan
    const params = [filtros.fechaInicio, filtros.fechaFin];

    // si mandan cuenta, la agrego al filtro
    if (filtros.idCuenta) {
        condiciones.push('r.id_cuenta = ?');
        params.push(filtros.idCuenta);
    }

    // si mandan campaña, filtro por la campaña del producto
    if (filtros.idCampania) {
        condiciones.push('p.id_campania = ?');
        params.push(filtros.idCampania);
    }

    // esta consulta regresa el detalle operativo por producto reservado
    const query = `
        SELECT
            r.folio,
            DATE(r.fecha) AS fecha,
            c.id_cuenta,
            c.nombre AS cuenta,
            u.nombre AS distribuidor,
            u.correo,
            COALESCE(ca.nombre, 'Sin campania') AS campania,
            rp."SKU" AS sku,
            p.nombre_comercial AS producto,
            rp.cantidad,
            ROUND(COALESCE(p.peso_unitario, 0), 2) AS peso_unitario,
            ROUND(COALESCE(p.volumen_unitario, 0), 2) AS volumen_unitario,
            ROUND(COALESCE(rp.cantidad * p.peso_unitario, 0), 2) AS peso_total_linea,
            ROUND(COALESCE(rp.cantidad * p.volumen_unitario, 0), 2) AS volumen_total_linea,
            ROUND(COALESCE(rp.subtotal_linea, 0), 2) AS subtotal_linea,
            COALESCE(s.nombre, 'Sin sucursal') AS sucursal,
            TRIM(
                CONCAT(
                    COALESCE(s.direccion, ''),
                    CASE WHEN COALESCE(s.municipio, '') <> '' THEN CONCAT(', ', s.municipio) ELSE '' END,
                    CASE WHEN COALESCE(s.estado, '') <> '' THEN CONCAT(', ', s.estado) ELSE '' END
                )
            ) AS direccion_entrega
        FROM "Reserva" r
        JOIN "Cuenta" c ON c.id_cuenta = r.id_cuenta
        JOIN "Usuario" u ON u.correo = r.correo
        JOIN "Reserva_Producto" rp ON rp.folio = r.folio
        JOIN "Producto" p ON p."SKU" = rp."SKU"
        LEFT JOIN "Campania" ca ON ca.id_campania = p.id_campania
        LEFT JOIN "Sucursal" s ON s.id_sucursal = r.id_sucursal
        WHERE ${condiciones.join('\n          AND ')}
        ORDER BY r.fecha DESC, r.fecha_cancelacion_reserva DESC, rp."SKU" ASC
    `;

    // aqui ejecuto la consulta ya con los filtros armados
    db.query(query, params, callback);
};
// lau final modelo reporte operativo

exports.crearReservaConProductos = (data, productos, callback) => {
    db.connect((connectErr, client, done) => {
        if (connectErr) {
            return callback(connectErr);
        }

        const rollback = (err) => {
            client.query('ROLLBACK', () => {
                done();
                callback(err);
            });
        };

        client.query('BEGIN', (beginErr) => {
            if (beginErr) return rollback(beginErr);

            const reservaQuery = `
                INSERT INTO "Reserva"
                (folio, estatus, fecha, subtotal, iva, total, fecha_cancelacion_reserva, correo, id_cuenta, id_sucursal)
                VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, $8, $9)
            `;

            client.query(reservaQuery, [
                data.folio,
                data.estatus,
                data.subtotal,
                data.iva,
                data.total,
                data.fecha_cancelacion_reserva,
                data.correo,
                data.id_cuenta,
                data.id_sucursal
            ], (reservaErr) => {
                if (reservaErr) {
                    return rollback(reservaErr);
                }

                if (!Array.isArray(productos) || productos.length === 0) {
                    return rollback(new Error('No hay productos para registrar en la reserva.'));
                }

                const productoQuery = `
                    INSERT INTO "Reserva_Producto"
                    (folio, "SKU", cantidad, precio_aplicado, subtotal_linea)
                    VALUES ($1, $2, $3, $4, $5)
                `;

                let pendientes = productos.length;
                let fallo = false;

                productos.forEach((producto) => {
                    if (fallo) return;

                    client.query(productoQuery, [
                        data.folio,
                        producto.sku,
                        producto.cantidad,
                        producto.precio,
                        producto.precio * producto.cantidad
                    ], (productoErr) => {
                        if (fallo) return;

                        if (productoErr) {
                            fallo = true;
                            return rollback(productoErr);
                        }

                        pendientes -= 1;

                        if (pendientes === 0) {
                            client.query('COMMIT', (commitErr) => {
                                if (commitErr) return rollback(commitErr);
                                done();
                                callback(null);
                            });
                        }
                    });
                });
            });
        });
    });
};

exports.obtenerResumenAdministrativo = (callback) => {
    const query = `
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN estatus = 1 THEN 1 ELSE 0 END) AS confirmadas,
            SUM(CASE WHEN estatus = 0 THEN 1 ELSE 0 END) AS canceladas
        FROM "Reserva"
    `;
    db.query(query, callback);
};

exports.obtenerReservasRecientesAdmin = (limite, callback) => {
    const query = `
        SELECT
            r.folio,
            r.fecha,
            r.total,
            r.estatus,
            u.nombre AS concesionario,
            c.nombre AS cuenta
        FROM "Reserva" r
        JOIN "Usuario" u ON u.correo = r.correo
        JOIN "Cuenta"  c ON c.id_cuenta = r.id_cuenta
        ORDER BY r.fecha DESC, r.fecha_cancelacion_reserva DESC
        LIMIT ?
    `;
    db.query(query, [limite], callback);
};



exports.obtenerRendimientoProductosCampania = (filtros, callback) => {
    // aqui defino las condiciones base de la consulta
    // solo quiero reservas confirmadas dentro del rango de fechas
    const condiciones = [
        'r.estatus = 1',
        'r.fecha BETWEEN ? AND ?'
    ];

    // aqui guardo los parametros que se van a inyectar en el query
    // primero siempre van las fechas
    const params = [filtros.fechaInicio, filtros.fechaFin];

    // aqui filtro por campania si ya tengo una campania seleccionada o activa
    if (filtros.idCampania) {
        condiciones.push('p.id_campania = ?');
        params.push(filtros.idCampania);
    }

    // aqui filtro por cuenta si el usuario quiere ver una cuenta especifica
    // ? es un placeholder que se reemplaza por el valor del arreglo params en orden, 
    // esto ayuda a prevenir inyecciones SQL
    if (filtros.idCuenta) {
        condiciones.push('r.id_cuenta = ?');
        params.push(filtros.idCuenta);
    }

    // aqui armo la consulta principal
    // voy a agrupar por producto para saber como rindio cada uno
    const query = `
        SELECT
            p."SKU" AS sku,
            p.nombre_comercial AS producto,
            COALESCE(ca.nombre, 'Sin campania') AS campania,
            COUNT(DISTINCT r.folio) AS preventas_confirmadas,
            COALESCE(SUM(rp.cantidad), 0) AS unidades_confirmadas,
            ROUND(COALESCE(SUM(rp.cantidad * p.peso_unitario), 0), 2) AS peso_total,
            ROUND(COALESCE(SUM(rp.cantidad * p.volumen_unitario), 0), 2) AS volumen_total,
            ROUND(COALESCE(SUM(rp.subtotal_linea), 0), 2) AS importe_total,
            COUNT(DISTINCT r.id_cuenta) AS cuentas_con_movimiento
        FROM "Reserva" r
        JOIN "Reserva_Producto" rp ON rp.folio = r.folio
        JOIN "Producto" p ON p."SKU" = rp."SKU"
        LEFT JOIN "Campania" ca ON ca.id_campania = p.id_campania
        WHERE ${condiciones.join('\n          AND ')}
        GROUP BY
            p."SKU",
            p.nombre_comercial,
            ca.nombre
        ORDER BY
            preventas_confirmadas DESC,
            peso_total DESC,
            volumen_total DESC,
            producto ASC
    `;

    // aqui ejecuto la consulta y regreso los resultados al controller
    db.query(query, params, callback);
};
