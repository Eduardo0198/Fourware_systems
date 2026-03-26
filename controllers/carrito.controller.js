const reservaModel = require('../models/reserva.model');
const bitacora = require('../models/bitacora.model');
const campaniaModel = require('../models/campania.model');
const concesionarioModel = require('../models/concesionario.model');

exports.agregarProducto = (req, res) => {
    const { sku, nombre, precio, cantidad, imagen, peso_unitario, volumen_unitario } = req.body;
    const cantidadNumerica = parseInt(cantidad, 10);

    if (!cantidadNumerica || cantidadNumerica <= 0) {
        req.session.mensaje = {
            tipo: 'danger',
            texto: 'La cantidad ingresada no es válida. Ingrese un valor mayor a cero.'
        };
        return res.redirect('back');
    }

    campaniaModel.obtenerCampaniaActiva((err, result) => {
        if (err) {
            bitacora.registrar(
                req.session.usuario?.correo || null,
                `Error al validar campaña para agregar producto ${sku}`,
                req.ip
            );
            req.session.mensaje = {
                tipo: 'danger',
                texto: 'No fue posible agregar el producto al carrito. Intente nuevamente.'
            };
            return res.redirect('back');
        }

        if (!result || result.length === 0) {
            bitacora.registrar(
                req.session.usuario?.correo || null,
                `Intento de agregar producto ${sku} sin campaña activa`,
                req.ip
            );
            req.session.mensaje = {
                tipo: 'warning',
                texto: 'La campaña de preventa no se encuentra disponible en este momento.'
            };
            return res.redirect('/concesionario/catalogo');
        }

        if (!req.session.carrito) {
            req.session.carrito = [];
        }

        let carrito = req.session.carrito;
        const index = carrito.findIndex(p => p.sku === sku);

        if (index !== -1) {
            carrito[index].cantidad += cantidadNumerica;
        } else {
            carrito.push({
                sku,
                nombre,
                imagen: imagen || '/img/ppg-logo.png',
                precio: parseFloat(precio),
                cantidad: cantidadNumerica,
                peso_unitario: parseFloat(peso_unitario) || 0,
                volumen_unitario: parseFloat(volumen_unitario) || 0
            });
        }

        req.session.carrito = carrito;

        const correo = req.session.usuario?.correo
                 || req.session.usuario?.usuario?.correo;
        bitacora.registrar(
            correo,
            `Agregó producto ${sku} al carrito`,
            req.ip
        );

        req.session.mensaje = {
            tipo: 'success',
            texto: 'Producto agregado correctamente al carrito.'
        };

        res.redirect('/concesionario/carrito');
    });
};

exports.verCarrito = (req, res) => {
    const carrito = req.session.carrito || [];
    const subtotal = carrito.reduce((acc, p) => {
        return acc + (p.precio * p.cantidad);
    }, 0);
    const totalPeso = carrito.reduce((acc, p) => {
        return acc + ((p.peso_unitario || 0) * p.cantidad);
    }, 0);
    const totalVolumen = carrito.reduce((acc, p) => {
        return acc + ((p.volumen_unitario || 0) * p.cantidad);
    }, 0);
    const iva = subtotal * 0.16;
    const total = subtotal + iva;

    res.render('modules/concesionarioCarrito', {
        carrito,
        subtotal,
        totalPeso,
        totalVolumen,
        iva,
        total
    });
};

exports.eliminarProducto = (req, res) => {
    const { sku } = req.params;
    let carrito = req.session.carrito || [];
    carrito = carrito.filter(p => p.sku !== sku);
    req.session.carrito = carrito;
    res.redirect('/concesionario/carrito');
};

exports.actualizarCantidad = (req, res) => {
    const { sku, accion } = req.body;
    const carrito = req.session.carrito || [];
    const index = carrito.findIndex(p => p.sku === sku);

    if (index === -1) {
        bitacora.registrar(
            req.session.usuario?.correo || null,
            `Intento de modificar producto ${sku} inexistente en carrito`,
            req.ip
        );
        req.session.mensaje = {
            tipo: 'warning',
            texto: 'El producto seleccionado no existe en el carrito.'
        };
        return res.redirect('/concesionario/carrito');
    }

    campaniaModel.obtenerCampaniaActiva((err, result) => {
        if (err) {
            bitacora.registrar(
                req.session.usuario?.correo || null,
                `Error al validar campaña para modificar producto ${sku}`,
                req.ip
            );
            req.session.mensaje = {
                tipo: 'danger',
                texto: 'No fue posible actualizar el producto en el carrito.'
            };
            return res.redirect('/concesionario/carrito');
        }

        if (!result || result.length === 0) {
            bitacora.registrar(
                req.session.usuario?.correo || null,
                `Intento de modificar producto ${sku} sin campaña activa`,
                req.ip
            );
            req.session.mensaje = {
                tipo: 'warning',
                texto: 'La campaña de preventa no se encuentra disponible.'
            };
            return res.redirect('/concesionario/carrito');
        }

        concesionarioModel.obtenerProductoPorSku(sku, (productoErr, producto) => {
            if (productoErr) {
                bitacora.registrar(
                    req.session.usuario?.correo || null,
                    `Error técnico al consultar disponibilidad del producto ${sku}`,
                    req.ip
                );
                req.session.mensaje = {
                    tipo: 'danger',
                    texto: 'No fue posible actualizar el producto en el carrito.'
                };
                return res.redirect('/concesionario/carrito');
            }

            if (!producto) {
                bitacora.registrar(
                    req.session.usuario?.correo || null,
                    `Producto ${sku} ya no disponible al modificar carrito`,
                    req.ip
                );
                req.session.mensaje = {
                    tipo: 'warning',
                    texto: 'El producto seleccionado ya no se encuentra disponible.'
                };
                return res.redirect('/concesionario/carrito');
            }

            const cambio = accion === 'incrementar' ? 1 : -1;
            const nuevaCantidad = carrito[index].cantidad + cambio;

            if (nuevaCantidad <= 0) {
                req.session.mensaje = {
                    tipo: 'danger',
                    texto: 'La cantidad ingresada no es válida. Ingrese un valor mayor a cero.'
                };
                return res.redirect('/concesionario/carrito');
            }

            carrito[index].cantidad = nuevaCantidad;
            req.session.carrito = carrito;

            bitacora.registrar(
                req.session.usuario?.correo || null,
                `Modificó la cantidad del producto ${sku} a ${nuevaCantidad}`,
                req.ip
            );

            return res.redirect('/concesionario/carrito');
        });
    });
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
        bitacora.registrar(
            usuario.correo,
            `Confirmó reserva ${folio}`,
            req.ip
        );
        req.session.carrito = [];
        res.send(`Reserva confirmada. Folio: ${folio}`);
    });
};
