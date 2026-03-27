const bitacoraModel = require('../models/bitacora.model');

function obtenerCorreo(req) {
    return req.session?.usuario?.correo || null;
}

function normalizarIp(ip) {
    if (!ip) {
        return '0.0.0.0';
    }

    const valor = String(ip).replace('::ffff:', '').trim();
    return valor === '::1' ? '127.0.0.1 (localhost)' : valor;
}

function registrarEvento(req, accion, correo = null) {
    bitacoraModel.registrar(
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

module.exports = {
    obtenerCorreo,
    normalizarIp,
    registrarEvento,
    incrementarIntento,
    reiniciarIntento
};
