const db = require('../config/db');

exports.registrar = (correo, accion, ip) => {
    const query = `
        INSERT INTO BitacoraAuditoria (fecha, accion, ip_origen, correo)
        VALUES (NOW(), ?, ?, ?)
    `;
    db.query(query, [accion, ip, correo]);
};