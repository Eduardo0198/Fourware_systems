const reservaModel = require('../models/reserva.model');
const bitacora = require('../models/bitacora.model');

// ===== INICIO caso 4 lau =====
const calcularTotales = (carrito = []) => {
    const subtotal = carrito.reduce((acc, p) => {
        return acc + (p.precio * p.cantidad);
    }, 0);

    const iva = subtotal * 0.16;
    const total = subtotal + iva;

    return { subtotal, iva, total };
};

const campanaVigente = (req) => req.session.campanaActiva !== false;
const productoDisponible = (producto) => producto && producto.activo !== false;
// ===== FIN caso 4 lau =====

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

    req.session.carrito = carrito;
    bitacora.registrar({
        correo: req.session.usuario.correo,
        accion: `Agregó producto ${sku} al carrito`,
        ip: req.ip
    });

    // ===== INICIO caso 4 lau =====
    // codigo original: res.redirect('/carrito');
    res.redirect('/concesionario/carrito');
    // ===== FIN caso 4 lau =====
};

exports.verCarrito = (req, res) => { //se cambia vista del carrito para mostrar totales y mensajes de error
    const carrito = req.session.carrito || [];

    // ===== INICIO caso 4 lau =====
    // codigo original:
    // const total = carrito.reduce((acc, p) => {
    //     return acc + (p.precio * p.cantidad);
    // }, 0);
    // res.render('modules/concesionarioCarrito', {
    //     carrito,
    //     total
    // });
    const { subtotal, iva, total } = calcularTotales(carrito);
    res.render('modules/concesionarioCarrito', {
        carrito,
        subtotal,
        iva,
        total,
        error: null,
        mensaje: null
    });
    // ===== FIN caso 4 lau =====
};

exports.eliminarProducto = (req, res) => {
    const { sku } = req.params;
    let carrito = req.session.carrito || [];
    carrito = carrito.filter(p => p.sku !== sku);
    req.session.carrito = carrito;

    // ===== INICIO caso 4 lau =====
    // codigo original: res.redirect('/carrito');
    res.redirect('/concesionario/carrito');
    // ===== FIN caso 4 lau =====
};

// ===== INICIO caso 4 lau =====
exports.actualizarCantidad = (req, res) => {
    const usuario = req.session.usuario;
    const { sku } = req.params;
    const carrito = req.session.carrito || [];
    const cantidadNueva = Number.parseInt(req.body.cantidad, 10);

    const renderCarrito = (error = null, mensaje = null) => {
        const { subtotal, iva, total } = calcularTotales(carrito);
        return res.render('modules/concesionarioCarrito', {
            carrito,
            subtotal,
            iva,
            total,
            error,
            mensaje
        });
    };

    if (!usuario) {
        bitacora.registrar({
            correo: 'sesion_no_vigente',
            accion: 'Intento modificar un producto del carrito sin sesion vigente',
            ip: req.ip
        });
        return res.redirect('/');
    }

    if (!carrito.length) {
        return renderCarrito('El carrito de preventa no contiene productos.');
    }

    if (!Number.isInteger(cantidadNueva) || cantidadNueva <= 0) {
        return renderCarrito('La cantidad ingresada no es válida.');
    }

    if (!campanaVigente(req)) {
        bitacora.registrar({
            correo: usuario.correo,
            accion: 'Intento modificar el carrito sin una campaña de preventa vigente',
            ip: req.ip
        });
        return renderCarrito('La campaña de preventa no se encuentra disponible.');
    }

    const producto = carrito.find((item) => item.sku === sku);

    if (!producto || !productoDisponible(producto)) {
        bitacora.registrar({
            correo: usuario.correo,
            accion: `Intento modificar un producto no disponible en el carrito: ${sku}`,
            ip: req.ip
        });
        return renderCarrito('El producto seleccionado ya no se encuentra disponible.');
    }

    try {
        producto.cantidad = cantidadNueva;
        req.session.carrito = carrito;

        bitacora.registrar({
            correo: usuario.correo,
            accion: `Modificó la cantidad del producto ${sku} a ${cantidadNueva} en el carrito`,
            ip: req.ip
        });

        return renderCarrito(null, 'Cantidad actualizada correctamente.');
    } catch (error) {
        console.log(error);
        bitacora.registrar({
            correo: usuario.correo,
            accion: `Error al actualizar el producto ${sku} en el carrito`,
            ip: req.ip
        });
        return renderCarrito('No fue posible actualizar el producto en el carrito.');
    }
};
// ===== FIN caso 4 lau =====
//encpsule en una funcion para reutilizar aqui! asi no duplicar codiho 
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

    // ===== INICIO caso 4 lau =====
    // codigo original:
    // let subtotal = carrito.reduce((acc, p) => {
    //     return acc + (p.precio * p.cantidad);
    // }, 0);
    // let iva = subtotal * 0.16;
    // let total = subtotal + iva;
    const { subtotal, iva, total } = calcularTotales(carrito);
    // ===== FIN caso 4 lau =====

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
