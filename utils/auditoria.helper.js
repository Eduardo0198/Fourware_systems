const bitacoraModel = require('../models/bitacora.model');

function normalizarIp(ip) {
    if (!ip) {
        return null;
    }

    return String(ip).replace('::ffff:', '');
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
