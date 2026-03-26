const db = require('../config/db');
const concesionarioModel = require('../models/concesionario.model');
const campaniaModel = require('../models/campania.model');

exports.home = (req, res) => {
    concesionarioModel.obtenerTopProductos((err, productos) => {

        if (err) {
            console.log(err);
            return res.send("Error al obtener productos");
        }
        campaniaModel.obtenerCampaniaActiva((err2, result) => {

            if (err2) {
                console.log(err2);
            }
            const campania = (result && result.length > 0) ? result[0] : null;
            res.render('modules/concesionarioHome', {
                productos: productos,
                campania: campania
            });

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
                return res.send("Error al obtener catálogo");
            }
            const { productos, total } = result;
            const totalPaginas = Math.ceil(total / limit);
            concesionarioModel.obtenerUnidadesVenta((err2, unidadesVenta) => {
                if (err2) {
                    console.log(err2);
                    unidadesVenta = [];
                }
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
            return res.send("Error al obtener producto");
        }
        if (!producto) {
            return res.send("Producto no encontrado");
        }
        res.render('modules/concesionarioProducto', {
            producto: producto
        });
    });
};


exports.confirmarReserva = (req, res) => {
    res.render('modules/concesionarioConfirmarReserva');
};

exports.reservas = (req, res) => {
    res.render('modules/concesionarioReservas');
};

exports.detalleReserva = (req, res) => {
    res.render('modules/concesionarioDetalleReserva', {
        folio: req.params.folio
    });
};

exports.cancelarReserva = (req, res) => {
    res.render('modules/concesionarioCancelarReserva');
};