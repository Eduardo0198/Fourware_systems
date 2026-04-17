const db = require('../config/db');

function normalizarPayload(correoOrPayload, accion, ip) {
    if (
        correoOrPayload &&
        typeof correoOrPayload === 'object' &&
        !Array.isArray(correoOrPayload)
    ) {
        return {
            correo: correoOrPayload.correo || null,
            accion: correoOrPayload.accion || '',
            ip: correoOrPayload.ip || null
        };
    }

    return {
        correo: correoOrPayload || null,
        accion: accion || '',
        ip: ip || null
    };
}

exports.registrar = (correoOrPayload, accion, ip, callback = () => {}) => {
    //CU03-Paso 9 /Paso 14 /Flujos alternativos:
    //Inserta en BitacoraAuditoria el evento recibido desde registrarEvento(...).
    const payload = normalizarPayload(correoOrPayload, accion, ip);
    const query = `
        INSERT INTO BitacoraAuditoria (fecha, accion, ip_origen, correo)
        VALUES (NOW(), ?, ?, ?)
    `;

    db.query(query, [payload.accion, payload.ip, payload.correo], callback);
};

exports.listarRecientes = (callback, limite = 100) => {
    const query = `
        SELECT id_log, fecha, accion, ip_origen, correo
        FROM BitacoraAuditoria
        ORDER BY fecha DESC, id_log DESC
        LIMIT ?
    `;

    db.query(query, [limite], callback);
};

exports.obtenerRegistrosFiltrados = (filtros, callback) => {
    const { correo, fechaInicio, fechaFin } = filtros;
    const condiciones = [];
    const parametros = [];

    if (correo) {
        condiciones.push('correo LIKE ?');
        parametros.push(`%${correo}%`);
    }

    if (fechaInicio) {
        condiciones.push('fecha >= ?');
        parametros.push(`${fechaInicio} 00:00:00`);
    }

    if (fechaFin) {
        condiciones.push('fecha <= ?');
        parametros.push(`${fechaFin} 23:59:59`);
    }

    const where = condiciones.length > 0
        ? `WHERE ${condiciones.join(' AND ')}`
        : '';

    const query = `
        SELECT id_log, DATE_FORMAT(fecha, '%Y-%m-%d %H:%i:%s') AS fecha, correo, accion, ip_origen
        FROM BitacoraAuditoria
        ${where}
        ORDER BY fecha DESC, id_log DESC
    `;

    db.query(query, parametros, callback);
};
