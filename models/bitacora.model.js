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
