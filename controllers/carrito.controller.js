const reservaModel = require('../models/reserva.model');
const bitacora = require('../models/bitacora.model');

exports.agregarProducto = (req, res) => {
    const { sku, nombre, precio, cantidad } = req.body;

    if (!cantidad || cantidad <= 0) {
        return res.send("Cantidad inválida");
    }

    if (!req.session.carrito) {
        req.session.carrito = [];
    }

    let carrito = req.session.carrito;
    const index = carrito.findIndex(p => p.sku === sku);

    if (index !== -1) {
        carrito[index].cantidad += parseInt(cantidad);
    } else {
        carrito.push({
            sku,
            nombre,
            precio: parseFloat(precio),
            cantidad: parseInt(cantidad)
        });
    }

    const total = carrito.reduce((acc, p) => {
        return acc + (p.precio * p.cantidad);
    }, 0);

    req.session.carrito = carrito;
    bitacora.registrar({
        correo: req.session.usuario.correo,
        accion: `Agregó producto ${sku} al carrito`,
        ip: req.ip
    });
    res.redirect('/carrito');
};

exports.verCarrito = (req, res) => {
    const carrito = req.session.carrito || [];
    const total = carrito.reduce((acc, p) => {
        return acc + (p.precio * p.cantidad);
    }, 0);
    res.render('modules/concesionarioCarrito', {
        carrito,
        total
    });
};

exports.eliminarProducto = (req, res) => {
    const { sku } = req.params;
    let carrito = req.session.carrito || [];
    carrito = carrito.filter(p => p.sku !== sku);
    req.session.carrito = carrito;
    res.redirect('/carrito');
};

exports.confirmarReserva = (req, res) => {
    const usuario = req.session.usuario;
    const carrito = req.session.carrito;
    const sucursal = req.body.sucursal;

    if (!usuario) {
        return res.redirect('/');
    }

    if (!carrito || carrito.length === 0) {
        return res.send("El carrito está vacío");
    }

    if (!sucursal) {
        return res.send("Debe seleccionar una sucursal");
    }

    let subtotal = carrito.reduce((acc, p) => {
        return acc + (p.precio * p.cantidad);
    }, 0);

    let iva = subtotal * 0.16;
    let total = subtotal + iva;
    const folio = "RES-" + Date.now();
    reservaModel.crearReserva({
        folio,
        subtotal,
        iva,
        total,
        correo: usuario.correo,
        id_sucursal: sucursal
    }, (err) => {
        if (err) {
            console.log(err);
            return res.send("Error al registrar la reserva");
        }
        reservaModel.insertarProductos(carrito, folio);
        bitacora.registrar({
            correo: usuario.correo,
            accion: `Confirmó reserva ${folio}`,
            ip: req.ip
        });
        req.session.carrito = [];
        res.send(`Reserva confirmada. Folio: ${folio}`);
    });
};
