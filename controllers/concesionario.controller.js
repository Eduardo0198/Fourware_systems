const db = require('../config/db');
const concesionarioModel = require('../models/concesionario.model');
const campaniaModel = require('../models/campania.model');
const cuentaModel = require('../models/cuenta.model');
const { registrarEvento } = require('../utils/auditoria.helper');

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
            req.session.mensaje = {
                tipo: 'warning',
                texto: 'La cuenta seleccionada se encuentra inactiva y no puede utilizarse.'
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

            // inicio caso 8 lau
            registrarEvento(req, 'Selección de cuenta activa', usuario.correo);
            // fin caso 8 lau

            req.session.mensaje = {
                tipo: 'success',
                texto: `Ahora estas operando con la cuenta ${cuenta.nombre}.`
            };

            return res.redirect(destino);
        });
    });
};

exports.catalogo = (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const searchTerm = req.query.q || '';
    const precioMin = req.query.precio_min ? parseFloat(req.query.precio_min) : 0;
    const precioMax = req.query.precio_max ? parseFloat(req.query.precio_max) : 10000;
    const unidadVenta = req.query.unidad_venta || '';
    concesionarioModel.obtenerProductosPaginados(
        page,
        limit,
        searchTerm,
        precioMin,
        precioMax,
        unidadVenta,
        (err, result) => {
            if (err) {
                console.log(err);
                // inicio caso 8 lau
                registrarEvento(req, 'Error al consultar catálogo de productos');
                // fin caso 8 lau
                return res.send("Error al obtener catálogo");
            }
            const { productos, total } = result;
            const totalPaginas = Math.ceil(total / limit);
            concesionarioModel.obtenerUnidadesVenta((err2, unidadesVenta) => {
                if (err2) {
                    console.log(err2);
                    unidadesVenta = [];
                }
                // inicio caso 8 lau
                const accionCatalogo = searchTerm
                    ? 'Búsqueda de productos en catálogo'
                    : 'Consulta de catálogo de productos';
                registrarEvento(req, accionCatalogo);
                // fin caso 8 lau
                res.render('modules/concesionarioCatalogo', {
                    productos: productos,
                    query: searchTerm,
                    precio_min: precioMin,
                    precio_max: precioMax,
                    unidad_venta_seleccionada: unidadVenta,
                    unidadesVenta: unidadesVenta,
                    paginacion: {
                        paginaActual: page,
                        totalPaginas: totalPaginas
                    }
                });
            });
        }
    );
};

exports.producto = (req, res) => {
    const sku = req.params.sku;
    concesionarioModel.obtenerProductoPorSku(sku, (err, producto) => {
        if (err) {
            console.log(err);
            // inicio caso 8 lau
            registrarEvento(req, 'Error al consultar detalle de producto');
            // fin caso 8 lau
            return res.send("Error al obtener producto");
        }
        if (!producto) {
            // inicio caso 8 lau
            registrarEvento(req, 'Intento de consulta de producto inexistente');
            // fin caso 8 lau
            return res.send("Producto no encontrado");
        }
        // inicio caso 8 lau
        registrarEvento(req, 'Consulta de detalle de producto');
        // fin caso 8 lau
        res.render('modules/concesionarioProducto', {
            producto: producto
        });
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
