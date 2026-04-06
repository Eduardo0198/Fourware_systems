const reservaModel = require('../models/reserva.model');
const campaniaModel = require('../models/campania.model');
const cancelacionModel = require('../models/cancelacion.model');
const concesionarioModel = require('../models/concesionario.model');
const cuentaModel = require('../models/cuenta.model');
const { registrarEvento } = require('../utils/auditoria.helper');

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

function obtenerCarritoActivo(req) {
    const cuentaActivaId = req.session.usuario?.cuentaActiva?.id_cuenta || null;

    if (req.session.carritoCuentaId && cuentaActivaId && req.session.carritoCuentaId !== cuentaActivaId) {
        req.session.carrito = [];
        req.session.carritoCuentaId = cuentaActivaId;
    }

    return req.session.carrito || [];
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
            registrarEvento(req, 'Error al agregar producto al carrito');
            req.session.mensaje = {
                tipo: 'danger',
                texto: 'No fue posible agregar el producto al carrito. Intente nuevamente.'
            };
            return res.redirect('back');
        }

        if (!result || result.length === 0) {
            registrarEvento(req, 'Intento de agregar producto al carrito sin campaña activa');
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
                registrarEvento(
                    req,
                    `Error al consultar producto ${sku} para agregar al carrito`,
                    req.session.usuario?.correo || null
                );
                req.session.mensaje = {
                    tipo: 'danger',
                    texto: 'No fue posible agregar el producto al carrito. Intente nuevamente.'
                };
                return res.redirect('back');
            }

            if (!producto) {
                registrarEvento(
                    req,
                    `Intento de agregar producto inexistente ${sku} al carrito`,
                    req.session.usuario?.correo || null
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
            registrarEvento(req, `Agregó producto ${sku} al carrito`, correo);

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
    const sku = String(req.body.sku || '').trim();

    try {
        const carrito = obtenerCarritoActivo(req);

        if (!Array.isArray(carrito) || carrito.length === 0) {
            req.session.mensaje = {
                tipo: 'warning',
                texto: 'El producto seleccionado no existe en el carrito actual.'
            };
            return res.redirect('/concesionario/carrito');
        }

        const index = carrito.findIndex((producto) => producto.sku === sku);

        if (index === -1) {
            req.session.mensaje = {
                tipo: 'warning',
                texto: 'El producto seleccionado no existe en el carrito actual.'
            };
            return res.redirect('/concesionario/carrito');
        }

        const [productoEliminado] = carrito.splice(index, 1);
        req.session.carrito = carrito;

        registrarEvento(
            req,
            `Eliminó producto ${productoEliminado?.sku || sku} del carrito`
        );

        req.session.mensaje = {
            tipo: 'success',
            texto: 'Producto eliminado correctamente del carrito.'
        };
        return res.redirect('/concesionario/carrito');
    } catch (error) {
        console.error(error);
        registrarEvento(req, `Error al eliminar producto ${sku || 'desconocido'} del carrito`);
        req.session.mensaje = {
            tipo: 'danger',
            texto: 'No fue posible eliminar el producto del carrito. Intente nuevamente.'
        };
        return res.redirect('/concesionario/carrito');
    }
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
        registrarEvento(req, 'Intento de modificar producto inexistente en carrito');
        req.session.mensaje = {
            tipo: 'warning',
            texto: 'El producto seleccionado no existe en el carrito.'
        };
        return res.redirect('/concesionario/carrito');
    }

    campaniaModel.obtenerCampaniaActiva((err, result) => {
        if (err) {
            registrarEvento(req, 'Error al modificar producto del carrito');
            req.session.mensaje = {
                tipo: 'danger',
                texto: 'No fue posible actualizar el producto en el carrito.'
            };
            return res.redirect('/concesionario/carrito');
        }

        if (!result || result.length === 0) {
            registrarEvento(req, 'Intento de modificar carrito sin campaña activa');
            req.session.mensaje = {
                tipo: 'warning',
                texto: 'La campaña de preventa no se encuentra disponible.'
            };
            return res.redirect('/concesionario/carrito');
        }

        concesionarioModel.obtenerProductoPorSku(sku, (productoErr, producto) => {
            if (productoErr) {
                registrarEvento(req, 'Error técnico al validar producto en carrito');
                req.session.mensaje = {
                    tipo: 'danger',
                    texto: 'No fue posible actualizar el producto en el carrito.'
                };
                return res.redirect('/concesionario/carrito');
            }

            if (!producto) {
                registrarEvento(req, 'Intento de modificar producto no disponible en carrito');
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

            registrarEvento(req, 'Modificación de productos en carrito');

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
        registrarEvento(req, 'Intentó confirmar una reserva con el carrito vacío', usuario.correo);
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
            registrarEvento(req, 'Error al validar campaña durante confirmación de reserva', usuario.correo);
            req.session.mensaje = {
                tipo: 'danger',
                texto: 'No fue posible confirmar la reserva. Intente nuevamente.'
            };
            return res.redirect('/concesionario/carrito');
        }

        const campaniaActiva = campanias && campanias[0];

        if (!campaniaActiva) {
            registrarEvento(req, 'Intentó confirmar una reserva sin campaña activa', usuario.correo);
            req.session.mensaje = {
                tipo: 'warning',
                texto: 'La campaña de preventa no se encuentra disponible.'
            };
            return res.redirect('/concesionario/carrito');
        }

        cuentaModel.obtenerSucursalesActivasPorCuenta(cuentaActivaId, (sucursalesErr, sucursales) => {
            if (sucursalesErr) {
                console.error(sucursalesErr);
                registrarEvento(req, 'Error al validar sucursal durante confirmación de reserva', usuario.correo);
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
                        registrarEvento(req, `Error al validar disponibilidad del producto ${item.sku}`, usuario.correo);
                        req.session.mensaje = {
                            tipo: 'danger',
                            texto: 'No fue posible confirmar la reserva. Intente nuevamente.'
                        };
                        return res.redirect('/concesionario/carrito');
                    }

                    if (!producto || Number(producto.activo) !== 1) {
                        errorDisponibilidad = true;
                        registrarEvento(req, `Producto ${item.sku} no disponible durante confirmación de reserva`, usuario.correo);
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
                                registrarEvento(req, 'Error al obtener la ventana de cancelación configurada', usuario.correo);
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
                                    registrarEvento(req, `Error al registrar la reserva ${folio}`, usuario.correo);
                                    req.session.mensaje = {
                                        tipo: 'danger',
                                        texto: 'No fue posible confirmar la reserva. Intente nuevamente.'
                                    };
                                    return res.redirect('/concesionario/carrito');
                                }

                                registrarEvento(req, `Confirmó reserva ${folio}`, usuario.correo);

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
