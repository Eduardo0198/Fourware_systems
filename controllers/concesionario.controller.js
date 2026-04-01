const db = require('../config/db');
const concesionarioModel = require('../models/concesionario.model');
const campaniaModel = require('../models/campania.model');
const cuentaModel = require('../models/cuenta.model');
const bitacora = require('../models/bitacora.model');
const { registrarEvento } = require('../utils/auditoria.helper');

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

function obtenerDatosCatalogo(req, callback) {
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

exports.home = (req, res) => {
    concesionarioModel.obtenerTopProductos((err, productos) => {

        if (err) {
            console.log(err);
            // inicio caso 8 lau
            registrarEvento(req, 'Error al consultar inicio de concesionario');
            // fin caso 8 lau
            return res.send("Error al obtener productos");
        }
        campaniaModel.obtenerCampaniaActiva((err2, result) => {

            if (err2) {
                console.log(err2);
            }
            const campania = (result && result.length > 0) ? result[0] : null;
            // inicio caso 8 lau
            registrarEvento(req, 'Consulta de inicio de concesionario');
            // fin caso 8 lau
            res.render('modules/concesionarioHome', {
                productos: productos,
                campania: campania
            });

        });

    });

};

exports.seleccionarCuentaActiva = (req, res) => {
    const usuario = req.session.usuario;
    const idCuenta = parseInt(req.body.id_cuenta, 10);
    const destino = req.get('referer') || '/concesionario/home';
    const cuentaAnteriorId = usuario?.cuentaActiva?.id_cuenta || null;

    if (!usuario || !usuario.correo || Number.isNaN(idCuenta)) {
        req.session.mensaje = {
            tipo: 'danger',
            texto: 'No fue posible actualizar la cuenta activa.'
        };
        return res.redirect(destino);
    }

    cuentaModel.obtenerCuentaPorCorreoYId(usuario.correo, idCuenta, (err, cuenta) => {
        if (err) {
            console.error(err);
            req.session.mensaje = {
                tipo: 'danger',
                texto: 'No fue posible actualizar la cuenta activa.'
            };
            return res.redirect(destino);
        }

        if (!cuenta) {
            req.session.mensaje = {
                tipo: 'danger',
                texto: 'La cuenta seleccionada no esta asociada a tu usuario.'
            };
            return res.redirect(destino);
        }

        if (!cuenta.activo) {
            bitacora.registrar(
                usuario.correo,
                `Intento de seleccionar cuenta inactiva ${cuenta.id_cuenta} - ${cuenta.nombre}`,
                req.ip
            );
            req.session.mensaje = {
                tipo: 'warning',
                texto: 'Esta cuenta está inactiva.'
            };
            return res.redirect(destino);
        }

        cuentaModel.obtenerCuentasPorCorreo(usuario.correo, (errCuentas, cuentas) => {
            if (errCuentas) {
                console.error(errCuentas);
                req.session.mensaje = {
                    tipo: 'danger',
                    texto: 'No fue posible actualizar la cuenta activa.'
                };
                return res.redirect(destino);
            }

            req.session.usuario.cuentas = cuentas;
            req.session.usuario.cuentaActiva =
                cuentas.find(item => item.id_cuenta === cuenta.id_cuenta) || cuenta;
            req.session.carritoCuentaId = cuenta.id_cuenta;

            if (cuentaAnteriorId && cuentaAnteriorId !== cuenta.id_cuenta) {
                req.session.carrito = [];
            }

            bitacora.registrar(
                usuario.correo,
                `Seleccionó la cuenta activa ${cuenta.id_cuenta} - ${cuenta.nombre}`,
                req.ip
            );

            req.session.mensaje = {
                tipo: 'success',
                texto: `Ahora estás operando con la cuenta ${cuenta.nombre}.`
            };

            return res.redirect(destino);
        });
    });
};

exports.catalogo = (req, res) => {
    obtenerDatosCatalogo(req, (err, data) => {
        if (err) {
            console.log(err);
            registrarEvento(req, 'Error al consultar catálogo de productos');
            return res.send("Error al obtener catálogo");
        }

        if (!data.campaniaActiva) {
            registrarEvento(req, 'Intento de consulta de catálogo sin campaña vigente');
            return res.render('modules/concesionarioCatalogo', {
                ...data,
                pageMessage: {
                    tipo: 'warning',
                    texto: 'No existe una campaña de preventa vigente.'
                }
            });
        }

        registrarEvento(
            req,
            data.query
                ? 'Búsqueda de productos mediante buscador predictivo'
                : 'Consulta de catálogo de productos'
        );

        return res.render('modules/concesionarioCatalogo', {
            ...data,
            pageMessage: null
        });
    });
};

exports.catalogoPredictivo = (req, res) => {
    req.query.page = '1';
    req.query.limit = '12';

    obtenerDatosCatalogo(req, (err, data) => {
        if (err) {
            console.log(err);
            registrarEvento(req, 'Error en búsqueda predictiva de catálogo');
            return res.status(500).json({
                ok: false,
                mensaje: 'No fue posible realizar la búsqueda.'
            });
        }

        if (!data.campaniaActiva) {
            registrarEvento(req, 'Intento de búsqueda predictiva sin campaña vigente');
            return res.status(409).json({
                ok: false,
                mensaje: 'No existe una campaña de preventa vigente.',
                productos: [],
                paginacion: {
                    paginaActual: 1,
                    totalPaginas: 0
                }
            });
        }

        registrarEvento(
            req,
            data.query
                ? 'Búsqueda predictiva de productos en catálogo'
                : 'Consulta predictiva de catálogo de productos'
        );

        return res.json({
            ok: true,
            productos: data.productos,
            paginacion: data.paginacion,
            query: data.query,
            precio_min: data.precio_min,
            precio_max: data.precio_max,
            unidad_venta_seleccionada: data.unidad_venta_seleccionada,
            hayBusquedaOFiltros: data.hayBusquedaOFiltros
        });
    });
};

exports.producto = (req, res) => {
    const sku = req.params.sku;

    campaniaModel.obtenerCampaniaActiva((campaniaErr, campanias) => {
        if (campaniaErr) {
            console.log(campaniaErr);
            registrarEvento(req, 'Error al validar campaña vigente para detalle de producto');
            req.session.mensaje = {
                tipo: 'danger',
                texto: 'Error en la consulta.'
            };
            return res.redirect('/concesionario/catalogo');
        }

        const campaniaActiva = Array.isArray(campanias) && campanias.length > 0
            ? campanias[0]
            : null;

        if (!campaniaActiva) {
            registrarEvento(req, 'Intento de consulta de detalle sin campaña vigente');
            req.session.mensaje = {
                tipo: 'warning',
                texto: 'La campaña de preventa no se encuentra disponible en este momento.'
            };
            return res.redirect('/concesionario/catalogo');
        }

        concesionarioModel.obtenerProductoActivoPorSkuYCampania(
            sku,
            campaniaActiva.id_campania,
            (err, producto) => {
                if (err) {
                    console.log(err);
                    registrarEvento(req, 'Error al consultar detalle técnico y logístico de producto');
                    req.session.mensaje = {
                        tipo: 'danger',
                        texto: 'Error en la consulta.'
                    };
                    return res.redirect('/concesionario/catalogo');
                }

                if (!producto) {
                    registrarEvento(req, 'Intento de consulta de producto no disponible');
                    req.session.mensaje = {
                        tipo: 'warning',
                        texto: 'El producto seleccionado ya no se encuentra disponible.'
                    };
                    return res.redirect('/concesionario/catalogo');
                }

                registrarEvento(req, 'Consulta de detalle técnico y logístico de producto');
                return res.render('modules/concesionarioProducto', {
                    producto
                });
            }
        );
    });
};


exports.confirmarReserva = (req, res) => {
    // inicio caso 8 lau
    registrarEvento(req, 'Consulta de confirmación de reserva');
    // fin caso 8 lau
    res.render('modules/concesionarioConfirmarReserva');
};

exports.reservas = (req, res) => {
    // inicio caso 8 lau
    registrarEvento(req, 'Consulta de historial de reservas');
    // fin caso 8 lau
    res.render('modules/concesionarioReservas');
};

exports.detalleReserva = (req, res) => {
    // inicio caso 8 lau
    registrarEvento(req, 'Consulta de detalle de reserva');
    // fin caso 8 lau
    res.render('modules/concesionarioDetalleReserva', {
        folio: req.params.folio
    });
};

exports.cancelarReserva = (req, res) => {
    // inicio caso 8 lau
    registrarEvento(req, 'Consulta de cancelación de reserva');
    // fin caso 8 lau
    res.render('modules/concesionarioCancelarReserva');
};
