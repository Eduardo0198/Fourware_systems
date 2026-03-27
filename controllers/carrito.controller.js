const reservaModel = require('../models/reserva.model');
const bitacora = require('../models/bitacora.model');
const campaniaModel = require('../models/campania.model');
const cancelacionModel = require('../models/cancelacion.model');
const concesionarioModel = require('../models/concesionario.model');
const cuentaModel = require('../models/cuenta.model');

function generarFolioReserva() {
    const ahora = new Date();
    const yy = String(ahora.getFullYear()).slice(-2);
    const mm = String(ahora.getMonth() + 1).padStart(2, '0');
    const dd = String(ahora.getDate()).padStart(2, '0');
    const hh = String(ahora.getHours()).padStart(2, '0');
    const mi = String(ahora.getMinutes()).padStart(2, '0');
    const ss = String(ahora.getSeconds()).padStart(2, '0');
    const random = Math.random().toString(36).slice(2, 6).toUpperCase();

    return `R${yy}${mm}${dd}${hh}${mi}${ss}${random}`;
}

function calcularFechaLimiteCancelacion(horas = 24) {
    const fecha = new Date();
    fecha.setHours(fecha.getHours() + horas);
    return fecha;
}

function construirItemCarrito(producto, cantidad) {
    return {
        sku: producto.SKU,
        nombre: producto.nombre,
        imagen: producto.imagen || '/img/ppg-logo.png',
        precio: Number(producto.precio_unitario) || 0,
        cantidad,
        peso_unitario: Number(producto.peso_unitario) || 0,
        volumen_unitario: Number(producto.volumen_unitario) || 0
    };
}

function sincronizarCarritoConProducto(itemActual, producto) {
    return {
        ...itemActual,
        ...construirItemCarrito(producto, itemActual.cantidad)
    };
}

exports.agregarProducto = (req, res) => {
    const sku = String(req.body.sku || '').trim();
    const cantidadNumerica = parseInt(req.body.cantidad, 10);
    const cuentaActivaId = req.session.usuario?.cuentaActiva?.id_cuenta || null;

    if (!sku || !Number.isInteger(cantidadNumerica) || cantidadNumerica <= 0) {
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

        if (req.session.carritoCuentaId && cuentaActivaId && req.session.carritoCuentaId !== cuentaActivaId) {
            req.session.carrito = [];
        }

        req.session.carritoCuentaId = cuentaActivaId;

        concesionarioModel.obtenerProductoPorSku(sku, (productoErr, producto) => {
            if (productoErr) {
                console.error(productoErr);
                bitacora.registrar(
                    req.session.usuario?.correo || null,
                    `Error al consultar producto ${sku} para agregar al carrito`,
                    req.ip
                );
                req.session.mensaje = {
                    tipo: 'danger',
                    texto: 'No fue posible agregar el producto al carrito. Intente nuevamente.'
                };
                return res.redirect('back');
            }

            if (!producto) {
                bitacora.registrar(
                    req.session.usuario?.correo || null,
                    `Intento de agregar producto inexistente ${sku} al carrito`,
                    req.ip
                );
                req.session.mensaje = {
                    tipo: 'warning',
                    texto: 'El producto seleccionado ya no se encuentra disponible.'
                };
                return res.redirect('/concesionario/catalogo');
            }

            const carrito = req.session.carrito;
            const index = carrito.findIndex(p => p.sku === sku);

            if (index !== -1) {
                carrito[index] = sincronizarCarritoConProducto(carrito[index], producto);
                carrito[index].cantidad += cantidadNumerica;
            } else {
                carrito.push(construirItemCarrito(producto, cantidadNumerica));
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

            return res.redirect('/concesionario/carrito');
        });
    });
};

exports.verCarrito = (req, res) => {
    const cuentaActivaId = req.session.usuario?.cuentaActiva?.id_cuenta || null;

    if (req.session.carritoCuentaId && cuentaActivaId && req.session.carritoCuentaId !== cuentaActivaId) {
        req.session.carrito = [];
        req.session.carritoCuentaId = cuentaActivaId;
    }

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
    const renderCarrito = (sucursales = []) => res.render('modules/concesionarioCarrito', {
        carrito,
        subtotal,
        totalPeso,
        totalVolumen,
        iva,
        total,
        sucursales
    });

    if (!cuentaActivaId) {
        return renderCarrito([]);
    }

    cuentaModel.obtenerSucursalesActivasPorCuenta(cuentaActivaId, (err, sucursales) => {
        if (err) {
            console.error(err);
            req.session.mensaje = {
                tipo: 'danger',
                texto: 'No fue posible cargar las sucursales disponibles.'
            };
            return renderCarrito([]);
        }

        return renderCarrito(sucursales || []);
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
    const cuentaActivaId = req.session.usuario?.cuentaActiva?.id_cuenta || null;

    if (req.session.carritoCuentaId && cuentaActivaId && req.session.carritoCuentaId !== cuentaActivaId) {
        req.session.carrito = [];
        req.session.carritoCuentaId = cuentaActivaId;
        req.session.mensaje = {
            tipo: 'warning',
            texto: 'El carrito fue reiniciado porque cambió la cuenta activa.'
        };
        return res.redirect('/concesionario/carrito');
    }

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

            carrito[index] = sincronizarCarritoConProducto(carrito[index], producto);
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
    const carrito = req.session.carrito || [];
    const sucursal = parseInt(req.body.sucursal, 10);
    const cuentaActivaId = usuario?.cuentaActiva?.id_cuenta || null;

    if (!usuario) {
        return res.redirect('/');
    }

    if (!carrito || carrito.length === 0) {
        bitacora.registrar(
            usuario.correo,
            'Intentó confirmar una reserva con el carrito vacío',
            req.ip
        );
        req.session.mensaje = {
            tipo: 'warning',
            texto: 'El carrito de preventa se encuentra vacío.'
        };
        return res.redirect('/concesionario/carrito');
    }

    if (!sucursal) {
        req.session.mensaje = {
            tipo: 'warning',
            texto: 'Debe seleccionar una sucursal para continuar.'
        };
        return res.redirect('/concesionario/carrito');
    }

    campaniaModel.obtenerCampaniaActiva((campaniaErr, campanias) => {
        if (campaniaErr) {
            console.error(campaniaErr);
            bitacora.registrar(
                usuario.correo,
                'Error al validar campaña durante confirmación de reserva',
                req.ip
            );
            req.session.mensaje = {
                tipo: 'danger',
                texto: 'No fue posible confirmar la reserva. Intente nuevamente.'
            };
            return res.redirect('/concesionario/carrito');
        }

        const campaniaActiva = campanias && campanias[0];

        if (!campaniaActiva) {
            bitacora.registrar(
                usuario.correo,
                'Intentó confirmar una reserva sin campaña activa',
                req.ip
            );
            req.session.mensaje = {
                tipo: 'warning',
                texto: 'La campaña de preventa no se encuentra disponible.'
            };
            return res.redirect('/concesionario/carrito');
        }

        cuentaModel.obtenerSucursalesActivasPorCuenta(cuentaActivaId, (sucursalesErr, sucursales) => {
            if (sucursalesErr) {
                console.error(sucursalesErr);
                bitacora.registrar(
                    usuario.correo,
                    'Error al validar sucursal durante confirmación de reserva',
                    req.ip
                );
                req.session.mensaje = {
                    tipo: 'danger',
                    texto: 'No fue posible confirmar la reserva. Intente nuevamente.'
                };
                return res.redirect('/concesionario/carrito');
            }

            const sucursalValida = Array.isArray(sucursales) && sucursales.some(item => item.id_sucursal === sucursal);

            if (!sucursalValida) {
                req.session.mensaje = {
                    tipo: 'warning',
                    texto: 'Debe seleccionar una sucursal para continuar.'
                };
                return res.redirect('/concesionario/carrito');
            }

            const productosValidados = [];
            let pendientes = carrito.length;
            let errorDisponibilidad = false;

            if (pendientes === 0) {
                req.session.mensaje = {
                    tipo: 'warning',
                    texto: 'El carrito de preventa se encuentra vacío.'
                };
                return res.redirect('/concesionario/carrito');
            }

            carrito.forEach((item) => {
                concesionarioModel.obtenerProductoPorSku(item.sku, (productoErr, producto) => {
                    if (errorDisponibilidad) {
                        return;
                    }

                    if (productoErr) {
                        errorDisponibilidad = true;
                        console.error(productoErr);
                        bitacora.registrar(
                            usuario.correo,
                            `Error al validar disponibilidad del producto ${item.sku}`,
                            req.ip
                        );
                        req.session.mensaje = {
                            tipo: 'danger',
                            texto: 'No fue posible confirmar la reserva. Intente nuevamente.'
                        };
                        return res.redirect('/concesionario/carrito');
                    }

                    if (!producto || Number(producto.activo) !== 1) {
                        errorDisponibilidad = true;
                        bitacora.registrar(
                            usuario.correo,
                            `Producto ${item.sku} no disponible durante confirmación de reserva`,
                            req.ip
                        );
                        req.session.mensaje = {
                            tipo: 'warning',
                            texto: 'Uno o más productos del carrito ya no se encuentran disponibles.'
                        };
                        return res.redirect('/concesionario/carrito');
                    }

                    pendientes -= 1;
                    productosValidados.push(construirItemCarrito(producto, item.cantidad));

                    if (pendientes === 0) {
                        req.session.carrito = productosValidados;

                        const subtotal = productosValidados.reduce((acc, p) => acc + (p.precio * p.cantidad), 0);
                        const iva = subtotal * 0.16;
                        const total = subtotal + iva;
                        const folio = generarFolioReserva();

                        cancelacionModel.obtener((configErr, configuracion) => {
                            if (configErr) {
                                console.error(configErr);
                                bitacora.registrar(
                                    usuario.correo,
                                    'Error al obtener la ventana de cancelación configurada',
                                    req.ip
                                );
                                req.session.mensaje = {
                                    tipo: 'danger',
                                    texto: 'No fue posible confirmar la reserva. Intente nuevamente.'
                                };
                                return res.redirect('/concesionario/carrito');
                            }

                            const horasCancelacion = configuracion?.horas_cancelacion || 24;
                            const fechaLimiteCancelacion = calcularFechaLimiteCancelacion(horasCancelacion);

                            reservaModel.crearReservaConProductos({
                                folio,
                                estatus: 1,
                                subtotal,
                                iva,
                                total,
                                fecha_cancelacion_reserva: fechaLimiteCancelacion,
                                correo: usuario.correo,
                                id_cuenta: cuentaActivaId,
                                id_sucursal: sucursal
                            }, productosValidados, (reservaErr) => {
                                if (reservaErr) {
                                    console.error(reservaErr);
                                    bitacora.registrar(
                                        usuario.correo,
                                        `Error al registrar la reserva ${folio}`,
                                        req.ip
                                    );
                                    req.session.mensaje = {
                                        tipo: 'danger',
                                        texto: 'No fue posible confirmar la reserva. Intente nuevamente.'
                                    };
                                    return res.redirect('/concesionario/carrito');
                                }

                                bitacora.registrar(
                                    usuario.correo,
                                    `Confirmó reserva ${folio}`,
                                    req.ip
                                );

                                req.session.carrito = [];
                                req.session.carritoCuentaId = cuentaActivaId;
                                req.session.mensaje = {
                                    tipo: 'success',
                                    texto: `Reserva confirmada exitosamente. Folio: ${folio}`
                                };

                                return res.redirect('/concesionario/carrito');
                            });
                        });
                    }
                });
            });
        });
    });
};
