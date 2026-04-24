const campaniaModel = require('../../models/campania.model');
const cuentaModel = require('../../models/cuenta.model');
const reservaModel = require('../../models/reserva.model');
const cancelacionModel = require('../../models/cancelacion.model');

const MENSAJE_RESERVA_INVALIDA = 'La reserva seleccionada no es válida.';
const MENSAJE_CANCELACION_FUERA_DE_PLAZO = 'La reserva ya no puede cancelarse porque el plazo permitido ha expirado.';
const MENSAJE_ERROR_CANCELACION = 'No fue posible cancelar la reserva. Intente nuevamente.';
const MENSAJE_CANCELACION_EXITOSA = 'La reserva ha sido cancelada correctamente.';

function formatearFecha(valor, incluirHora = false) {
    if (!valor) {
        return 'No disponible';
    }

    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) {
        return String(valor);
    }

    return fecha.toLocaleString('es-MX', incluirHora
        ? {
            dateStyle: 'medium',
            timeStyle: 'short'
        }
        : {
            dateStyle: 'medium'
        });
}

function normalizarReserva(reserva, horasCancelacion = 24) {
    const estatusNumerico = Number(reserva.estatus);
    const fechaLimite = reserva.fecha_cancelacion_reserva
        ? new Date(reserva.fecha_cancelacion_reserva)
        : null;
    const fechaActual = new Date();
    const limiteValida = fechaLimite && !Number.isNaN(fechaLimite.getTime());
    const cancelacionDisponible = estatusNumerico === 1
        && limiteValida
        && fechaActual <= fechaLimite;

    return {
        ...reserva,
        estatusNumerico,
        estatusTexto: estatusNumerico === 0 ? 'Cancelada' : 'Confirmada',
        estatusClase: estatusNumerico === 0 ? 'danger' : 'success',
        horasCancelacion,
        fechaTexto: formatearFecha(reserva.fecha),
        fechaCancelacionTexto: formatearFecha(reserva.fecha_cancelacion_reserva, true),
        fechaCancelacionISO: limiteValida ? fechaLimite.toISOString() : null,
        fechaSucursalTexto: reserva.nombre_sucursal
            ? `${reserva.nombre_sucursal}`
            : 'Sucursal no disponible',
        puedeCancelar: cancelacionDisponible,
        cancelacionExpirada: estatusNumerico === 1 && !cancelacionDisponible,
        direccionSucursal: [
            reserva.direccion,
            reserva.municipio,
            reserva.estado
        ].filter(Boolean).join(', ')
    };
}

function obtenerReservaNormalizada(folio, correo, idCuenta, callback) {
    cancelacionModel.obtener((configErr, configuracion) => {
        if (configErr) {
            return callback(configErr);
        }

        reservaModel.obtenerDetallePorFolioCorreoYCuenta(folio, correo, idCuenta, (reservaErr, reserva) => {
            if (reservaErr) {
                return callback(reservaErr);
            }

            if (!reserva) {
                return callback(null, null);
            }

            return callback(null, normalizarReserva(reserva, configuracion?.horas_cancelacion || 24));
        });
    });
}

function validarReservaCancelable(reserva) {
    if (!reserva || reserva.estatusNumerico !== 1) {
        return {
            valida: false,
            mensaje: MENSAJE_RESERVA_INVALIDA
        };
    }

    if (!reserva.puedeCancelar) {
        return {
            valida: false,
            mensaje: MENSAJE_CANCELACION_FUERA_DE_PLAZO
        };
    }

    return {
        valida: true,
        mensaje: null
    };
}

function obtenerContextoCuentaActiva(req, callback) {
    const correo = req.session.usuario?.correo;
    const idCuenta = req.session.usuario?.cuentaActiva?.id_cuenta;

    if (!correo || !idCuenta) {
        return callback(null, null);
    }

    cuentaModel.obtenerCuentaPorCorreoYId(correo, idCuenta, (err, cuenta) => {
        if (err) {
            return callback(err);
        }

        if (!cuenta || !cuenta.activo) {
            return callback(null, null);
        }

        return callback(null, { correo, idCuenta });
    });
}

function renderHistorialReservas(res, reservas, pageMessage = null) {
    res.render('modules/concesionarioReservas', {
        reservas,
        pageMessage
    });
}

function construirConsultaCatalogo(req) {
    return {
        page: parseInt(req.query.page, 10) || 1,
        limit: parseInt(req.query.limit, 10) || 12,
        searchTerm: String(req.query.q || '').trim(),
        precioMin: req.query.precio_min ? parseFloat(req.query.precio_min) : 0,
        precioMax: req.query.precio_max ? parseFloat(req.query.precio_max) : 10000,
        unidadVenta: String(req.query.unidad_venta || '').trim()
    };
}

function tieneBusquedaOFiltros(req, searchTerm, unidadVenta) {
    return (
        searchTerm !== ''
        || typeof req.query.precio_min !== 'undefined'
        || typeof req.query.precio_max !== 'undefined'
        || unidadVenta !== ''
    );
}

function obtenerDatosCatalogo(req, concesionarioModel, callback) {
    const {
        page,
        limit,
        searchTerm,
        precioMin,
        precioMax,
        unidadVenta
    } = construirConsultaCatalogo(req);

    campaniaModel.obtenerCampaniaActiva((campaniaErr, campanias) => {
        if (campaniaErr) {
            return callback(campaniaErr);
        }

        const campaniaActiva = Array.isArray(campanias) && campanias.length > 0
            ? campanias[0]
            : null;

        if (!campaniaActiva) {
            return callback(null, {
                campaniaActiva: null,
                productos: [],
                unidadesVenta: [],
                paginacion: {
                    paginaActual: 1,
                    totalPaginas: 0
                },
                query: searchTerm,
                precio_min: precioMin,
                precio_max: precioMax,
                unidad_venta_seleccionada: unidadVenta,
                hayBusquedaOFiltros: tieneBusquedaOFiltros(req, searchTerm, unidadVenta)
            });
        }

        concesionarioModel.obtenerProductosPaginados(
            page,
            limit,
            searchTerm,
            precioMin,
            precioMax,
            unidadVenta,
            campaniaActiva.id_campania,
            (productosErr, result) => {
                if (productosErr) {
                    return callback(productosErr);
                }

                const { productos, total } = result;
                const totalPaginas = Math.ceil(total / limit);

                concesionarioModel.obtenerUnidadesVenta(campaniaActiva.id_campania, (unidadesErr, unidadesVenta) => {
                    if (unidadesErr) {
                        return callback(unidadesErr);
                    }

                    return callback(null, {
                        campaniaActiva,
                        productos,
                        unidadesVenta,
                        paginacion: {
                            paginaActual: page,
                            totalPaginas
                        },
                        query: searchTerm,
                        precio_min: precioMin,
                        precio_max: precioMax,
                        unidad_venta_seleccionada: unidadVenta,
                        hayBusquedaOFiltros: tieneBusquedaOFiltros(req, searchTerm, unidadVenta)
                    });
                });
            }
        );
    });
}

module.exports = {
    MENSAJE_CANCELACION_EXITOSA,
    MENSAJE_CANCELACION_FUERA_DE_PLAZO,
    MENSAJE_ERROR_CANCELACION,
    MENSAJE_RESERVA_INVALIDA,
    formatearFecha,
    normalizarReserva,
    obtenerContextoCuentaActiva,
    obtenerDatosCatalogo,
    obtenerReservaNormalizada,
    renderHistorialReservas,
    validarReservaCancelable
};
