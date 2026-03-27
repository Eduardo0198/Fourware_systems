const bitacora = require('../models/bitacora.model');

// inicio caso 8 lau
function obtenerCorreo(req) {
    return req.session?.usuario?.correo || null;
}

function normalizarIp(ip) {
    if (!ip) {
        return '0.0.0.0';
    }

    if (ip === '::1') {
        return '127.0.0.1';
    }

    if (ip.startsWith('::ffff:')) {
        return ip.replace('::ffff:', '');
    }

    return ip;
}

function registrarEvento(req, accion, correo) {
    bitacora.registrar(
        correo || obtenerCorreo(req),
        accion,
        normalizarIp(req.ip)
    );
}

function incrementarIntento(req, clave) {
    if (!req.session) {
        return 1;
    }

    if (!req.session.intentosAuditoria) {
        req.session.intentosAuditoria = {};
    }

    req.session.intentosAuditoria[clave] =
        (req.session.intentosAuditoria[clave] || 0) + 1;

    return req.session.intentosAuditoria[clave];
}

function reiniciarIntento(req, clave) {
    if (req.session && req.session.intentosAuditoria) {
        delete req.session.intentosAuditoria[clave];
    }
}
// fin caso 8 lau

module.exports = {
    // inicio caso 8 lau
    obtenerCorreo,
    normalizarIp,
    registrarEvento,
    incrementarIntento,
    reiniciarIntento
    // fin caso 8 lau
};
