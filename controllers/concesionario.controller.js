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
    res.render('modules/concesionarioCatalogo');
};

exports.producto = (req, res) => {
    res.render('modules/concesionarioProducto', {
        sku: req.params.sku
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