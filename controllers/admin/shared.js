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

function normalizarCampania(campania) {
    if (!campania) {
        return null;
    }

    const inicio = new Date(campania.fecha_inicio);
    const fin = new Date(campania.fecha_fin);

    return {
        ...campania,
        estatus: Number(campania.estatus) === 1 ? 1 : 0,
        estatusTexto: Number(campania.estatus) === 1 ? 'Activa' : 'Inactiva',
        fecha_inicio_input: inicio.toISOString().slice(0, 10),
        fecha_fin_input: fin.toISOString().slice(0, 10),
        fecha_inicio_texto: inicio.toLocaleDateString('es-MX'),
        fecha_fin_texto: fin.toLocaleDateString('es-MX')
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
