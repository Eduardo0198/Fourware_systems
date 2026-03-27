const db = require('../config/db');

function normalizarCuenta(row) {
    const activa = Number(row.activo) === 1;

    return {
        id_cuenta: row.id_cuenta,
        nombre: row.nombre,
        codigo: row.RFC || `CTA-${row.id_cuenta}`,
        razon_social: row.razon_social,
        direccion: row.direccion || 'Sin direccion registrada',
        activo: activa,
        estatus: activa ? 'Activa' : 'Inactiva'
    };
}

exports.obtenerCuentasPorCorreo = (correo, callback) => {
    const query = `
        SELECT
            c.id_cuenta,
            c.nombre,
            c.RFC,
            c.razon_social,
            c.activo,
            (
                SELECT CONCAT_WS(', ', s.direccion, s.municipio, s.estado)
                FROM Sucursal s
                WHERE s.id_cuenta = c.id_cuenta
                ORDER BY s.activo DESC, s.id_sucursal ASC
                LIMIT 1
            ) AS direccion
        FROM Usuario_Cuenta uc
        JOIN Cuenta c ON c.id_cuenta = uc.id_cuenta
        WHERE uc.correo = ?
        ORDER BY c.id_cuenta ASC
    `;

    db.query(query, [correo], (err, rows) => {
        if (err) {
            return callback(err);
        }

        callback(null, rows.map(normalizarCuenta));
    });
};

exports.obtenerCuentaPorCorreoYId = (correo, idCuenta, callback) => {
    const query = `
        SELECT
            c.id_cuenta,
            c.nombre,
            c.RFC,
            c.razon_social,
            c.activo,
            (
                SELECT CONCAT_WS(', ', s.direccion, s.municipio, s.estado)
                FROM Sucursal s
                WHERE s.id_cuenta = c.id_cuenta
                ORDER BY s.activo DESC, s.id_sucursal ASC
                LIMIT 1
            ) AS direccion
        FROM Usuario_Cuenta uc
        JOIN Cuenta c ON c.id_cuenta = uc.id_cuenta
        WHERE uc.correo = ? AND c.id_cuenta = ?
        LIMIT 1
    `;

    db.query(query, [correo, idCuenta], (err, rows) => {
        if (err) {
            return callback(err);
        }

        callback(null, rows.length ? normalizarCuenta(rows[0]) : null);
    });
};

exports.obtenerCuentaActivaPorDefecto = (cuentas) => {
    if (!Array.isArray(cuentas) || cuentas.length === 0) {
        return null;
    }

    return cuentas.find(cuenta => cuenta.activo) || null;
};

exports.obtenerSucursalesActivasPorCuenta = (idCuenta, callback) => {
    const query = `
        SELECT
            id_sucursal,
            nombre,
            direccion,
            municipio,
            estado
        FROM Sucursal
        WHERE id_cuenta = ? AND activo = 1
        ORDER BY nombre ASC, id_sucursal ASC
    `;

    db.query(query, [idCuenta], callback);
};
