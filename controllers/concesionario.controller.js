exports.catalogo = (req, res) => {
    res.render(
        'modules/concesionarioCatalogo'
    );
};

exports.producto = (req, res) => {
    res.render(
        'modules/concesionarioProducto',
        {
            sku: req.params.sku
        }
    );
};

exports.confirmarReserva = (req, res) => {
    res.render(
        'modules/concesionarioConfirmarReserva'
    );
};

exports.reservas = (req, res) => {
    res.render(
        'modules/concesionarioReservas'
    );
};

exports.detalleReserva = (req, res) => {
    res.render(
        'modules/concesionarioDetalleReserva',
        {
            folio: req.params.folio
        }
    );
};

exports.cancelarReserva = (req, res) => {

    res.render(
        'modules/concesionarioCancelarReserva'
    );

};