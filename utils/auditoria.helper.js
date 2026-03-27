const bitacoraModel = require('../models/bitacora.model');

function normalizarIp(ip) {
    if (!ip) {
        return null;
    }

    const valor = String(ip).replace('::ffff:', '').trim();
    return valor === '::1' ? '127.0.0.1 (localhost)' : valor;
}

function registrarEvento(req, accion, correo = null) {
    bitacoraModel.registrar(
        correo || req.session?.usuario?.correo || null,
        accion,
        normalizarIp(req.ip)
    );
}

module.exports = {
    normalizarIp,
    registrarEvento
};
