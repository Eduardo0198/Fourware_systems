const reservaModel = require('../models/reserva.model');

function formatearFecha(fecha, incluirHora = false) {
    if (!fecha) {
        return 'No disponible';
    }

    const date = new Date(fecha);

    if (Number.isNaN(date.getTime())) {
        return 'No disponible';
    }

    return date.toLocaleString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        ...(incluirHora
            ? {
                hour: '2-digit',
                minute: '2-digit'
            }
            : {})
    });
}

function construirDireccionSucursal(reserva) {
    return [
        reserva?.direccion,
        reserva?.municipio,
        reserva?.estado
    ].filter(Boolean).join(', ');
}

function normalizarProductos(productos) {
    return (Array.isArray(productos) ? productos : []).map((producto) => ({
        sku: producto.SKU,
        nombre: producto.nombre_comercial || 'Producto sin nombre',
        cantidad: Number(producto.cantidad || 0),
        precioAplicado: Number(producto.precio_aplicado || 0),
        subtotalLinea: Number(producto.subtotal_linea || 0),
        imagen: producto.imagen || '/img/ppg-logo.png'
    }));
}

function normalizarReservaParaCorreo(reserva) {
    const productos = normalizarProductos(reserva?.productos);

    return {
        folio: reserva.folio,
        correo: reserva.correo,
        subtotal: Number(reserva.subtotal || 0),
        iva: Number(reserva.iva || 0),
        total: Number(reserva.total || 0),
        fechaTexto: formatearFecha(reserva.fecha, true),
        fechaCancelacionTexto: formatearFecha(reserva.fecha_cancelacion_reserva, true),
        sucursalNombre: reserva.nombre_sucursal || 'Sin sucursal registrada',
        sucursalDireccion: construirDireccionSucursal(reserva) || 'Sin dirección registrada',
        productos
    };
}

function obtenerDetalleReservaParaCorreo({ folio, correo, idCuenta }, callback) {
    reservaModel.obtenerDetallePorFolioCorreoYCuenta(folio, correo, idCuenta, (err, reserva) => {
        if (err) {
            return callback(err);
        }

        if (!reserva) {
            return callback(new Error(`No se encontró la reserva ${folio} para enviar correo.`));
        }

        return callback(null, normalizarReservaParaCorreo(reserva));
    });
}

module.exports = {
    obtenerDetalleReservaParaCorreo
};
