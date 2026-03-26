const db = require('../config/db');

exports.registrar = (correo, accion, ip) => {
    // caso 4 lau: permite usar la bitacora con objeto o con parametros sueltos
    if (typeof correo === 'object' && correo !== null) {
        ip = correo.ip;
        accion = correo.accion;
        correo = correo.correo;
    }
    // FIN caso 4 lau
    const query = `
        INSERT INTO BitacoraAuditoria (fecha, accion, ip_origen, correo)
        VALUES (NOW(), ?, ?, ?)
    `;
    db.query(query, [accion, ip, correo]);
};
