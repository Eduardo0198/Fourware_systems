const db = require('../config/db');

exports.registrar = (correo, accion, ip) => {
    const query = `
        INSERT INTO BitacoraAuditoria (fecha, accion, ip_origen, correo)
        VALUES (NOW(), ?, ?, ?)
    `;
    db.query(query, [accion, ip, correo]);
};

// inicio caso 8 lau
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
// fin caso 8 lau
