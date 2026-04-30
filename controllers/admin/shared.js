const bitacoraModel = require('../../models/bitacora.model');
const campaniaModel = require('../../models/campania.model');
const cancelacionModel = require('../../models/cancelacion.model');
const productoModel = require('../../models/producto.model');
const { registrarEvento, normalizarIp } = require('../../utils/auditoria.helper');

function aNumeroDecimal(valor) {
    const numero = parseFloat(valor);
    return Number.isFinite(numero) ? numero : NaN;
}

function esFechaValida(valor) {
    return Boolean(valor) && !Number.isNaN(new Date(valor).getTime());
}

function registrarBitacora(req, accion, correo) {
    bitacoraModel.registrar(
        correo || req.session?.usuario?.correo || null,
        accion,
        normalizarIp(req.ip)
    );
}

function parseFechaLocal(fechaStr) {
    const [y, m, d] = String(fechaStr || '').split('-').map(Number);
    if (!y || !m || !d) return new Date(NaN);
    return new Date(y, m - 1, d);
}

function normalizarCampania(campania) {
    if (!campania) {
        return null;
    }

    return {
        ...campania,
        estatus: Number(campania.estatus) === 1 ? 1 : 0,
        estatusTexto: Number(campania.estatus) === 1 ? 'Activa' : 'Inactiva',
        fecha_inicio_input: String(campania.fecha_inicio || '').slice(0, 10),
        fecha_fin_input:    String(campania.fecha_fin    || '').slice(0, 10),
        fecha_inicio_texto: parseFechaLocal(campania.fecha_inicio).toLocaleDateString('es-MX'),
        fecha_fin_texto:    parseFechaLocal(campania.fecha_fin).toLocaleDateString('es-MX')
    };
}

function normalizarProducto(producto) {
    return {
        ...producto,
        activo: Number(producto.activo) === 1 ? 1 : 0,
        estatusTexto: Number(producto.activo) === 1 ? 'Activo' : 'Inactivo'
    };
}

module.exports = {
    aNumeroDecimal,
    bitacoraModel,
    campaniaModel,
    cancelacionModel,
    esFechaValida,
    normalizarCampania,
    normalizarProducto,
    productoModel,
    registrarBitacora,
    registrarEvento
};
