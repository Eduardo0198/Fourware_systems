const reservaModel = require('../models/reserva.model');
const campaniaModel = require('../models/campania.model');
const cancelacionModel = require('../models/cancelacion.model');
const concesionarioModel = require('../models/concesionario.model');
const cuentaModel = require('../models/cuenta.model');
const { registrarEvento } = require('../utils/auditoria.helper');
const logger = require('../utils/logger');
const { obtenerDetalleReservaParaCorreo } = require('../services/reservaDetalle.service');
const { enviarCorreoReservaConfirmada } = require('../services/email.service');
const {
    calcularFechaLimiteCancelacion,
    calcularResumenCarrito,
    construirItemCarrito,
    construirRedirectCatalogo,
    generarFolioReserva,
    obtenerCarritoActivo,
    obtenerCarritoActivoDesdeSesion,
    obtenerSkusDelCarrito,
    vaciarCarritoActivoDesdeSesion,
    sincronizarCarritoConProducto
} = require('../services/carrito.service');
const Carrito = require('../services/Carrito');

function notificarReservaConfirmada(req, { folio, correo, idCuenta }) {
    setImmediate(() => {
        obtenerDetalleReservaParaCorreo({ folio, correo, idCuenta }, (detalleErr, reservaCorreo) => {
            if (detalleErr) {
                logger.error(detalleErr);
                registrarEvento(req, `Error al preparar correo de confirmación para la reserva ${folio}`, correo);
                return;
            }

            enviarCorreoReservaConfirmada({
                destinatario: correo,
                reserva: reservaCorreo
            })
                .then((resultado) => {
                    if (resultado.omitido) {
                        registrarEvento(req, `Correo de confirmación omitido para la reserva ${folio}`, correo);
                        return;
                    }

                    registrarEvento(req, `Correo de confirmación enviado para la reserva ${folio}`, correo);
                })
                .catch((emailErr) => {
                    logger.error(emailErr);
                    registrarEvento(req, `Error al enviar correo de confirmación para la reserva ${folio}`, correo);
                });
        });
    });
}

function validarHayProductos(carrito) {
    return Array.isArray(carrito) && carrito.length > 0;
}

exports.agregarProducto = (req, res) => {
    const sku = String(req.body.sku || '').trim();
    const cantidadNumerica = parseInt(req.body.cantidad, 10);
    const cuentaActivaId = req.session.usuario?.cuentaActiva?.id_cuenta || null;
    const redirectCatalogo = construirRedirectCatalogo(req.body.return_to, sku);
    const esAjax = req.headers['x-requested-with'] === 'XMLHttpRequest';

    const respError = (tipo, texto, statusCode) => {
        if (esAjax) return res.status(statusCode || 400).json({ ok: false, mensaje: texto });
        req.session.mensaje = { tipo, texto };
        return res.redirect('back');
    };

    if (!sku || !Number.isInteger(cantidadNumerica) || cantidadNumerica <= 0) {
        return respError('danger', 'La cantidad ingresada no es válida. Ingrese un valor mayor a cero.');
    }

    campaniaModel.obtenerCampaniaActiva((err, result) => {
        if (err) {
            registrarEvento(req, 'Error al agregar producto al carrito');
            return respError('danger', 'No fue posible agregar el producto al carrito. Intente nuevamente.', 500);
        }

        if (!result || result.length === 0) {
            registrarEvento(req, 'Intento de agregar producto al carrito sin campaña activa');
            if (esAjax) return res.status(409).json({ ok: false, mensaje: 'La campaña de preventa no está disponible.' });
            req.session.mensaje = { tipo: 'warning', texto: 'La campaña de preventa no se encuentra disponible en este momento.' };
            return res.redirect('/concesionario/catalogo');
        }

        if (!req.session.carrito) req.session.carrito = [];

        if (req.session.carritoCuentaId && cuentaActivaId && req.session.carritoCuentaId !== cuentaActivaId) {
            req.session.carrito = [];
        }

        req.session.carritoCuentaId = cuentaActivaId;

        const un_carrito = new Carrito(req.session.carrito, cuentaActivaId);

        concesionarioModel.obtenerProductoPorSku(sku, (productoErr, producto) => {
            if (productoErr) {
                logger.error(productoErr);
                registrarEvento(req, `Error al consultar producto ${sku} para agregar al carrito`, req.session.usuario?.correo || null);
                return respError('danger', 'No fue posible agregar el producto al carrito. Intente nuevamente.', 500);
            }

            if (!producto) {
                registrarEvento(req, `Intento de agregar producto inexistente ${sku} al carrito`, req.session.usuario?.correo || null);
                if (esAjax) return res.status(404).json({ ok: false, mensaje: 'El producto ya no se encuentra disponible.' });
                req.session.mensaje = { tipo: 'warning', texto: 'El producto seleccionado ya no se encuentra disponible.' };
                return res.redirect('/concesionario/catalogo');
            }

            const index = un_carrito.existeProducto(sku);

            if (index !== -1) {
                un_carrito.actualizarCantidad(index, producto, cantidadNumerica);
            } else {
                un_carrito.agregarProducto(construirItemCarrito(producto, cantidadNumerica));
            }

            req.session.carrito = un_carrito.toArray();

            const correo = req.session.usuario?.correo || req.session.usuario?.usuario?.correo;
            registrarEvento(req, `Agregó producto ${sku} al carrito`, correo);

            if (esAjax) return res.json({ ok: true, carritoCount: req.session.carrito.length, sku });

            req.session.mensaje = { tipo: 'success', texto: 'Producto agregado correctamente al carrito.' };
            return res.redirect(redirectCatalogo);
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
    const {
        subtotal,
        totalPeso,
        totalVolumen,
        iva,
        total
    } = calcularResumenCarrito(carrito);
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
            logger.error(err);
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
        logger.error(error);
        registrarEvento(req, `Error al eliminar producto ${sku || 'desconocido'} del carrito`);
        req.session.mensaje = {
            tipo: 'danger',
            texto: 'No fue posible eliminar el producto del carrito. Intente nuevamente.'
        };
        return res.redirect('/concesionario/carrito');
    }
};

exports.vaciarCarritoCompleto = (req, res, done = null) => {
    const responder = (payload) => {
        if (typeof done === 'function') {
            return done(payload);
        }

        req.session.mensaje = {
            tipo: payload.tipo,
            texto: payload.texto
        };
        return res.redirect(payload.redirectTo);
    };

    try {
        const carrito = obtenerCarritoActivoDesdeSesion(req);

        if (!validarHayProductos(carrito)) {
            return responder({
                tipo: 'warning',
                texto: 'El carrito ya se encuentra vacío.',
                redirectTo: '/concesionario/carrito'
            });
        }

        const listaSkus = obtenerSkusDelCarrito(carrito);
        vaciarCarritoActivoDesdeSesion(req);

        return registrarEvento(
            req,
            `Se ha vaciado el carrito de preventa. SKU eliminados: ${listaSkus.join(', ')}`,
            (auditErr) => {
                if (auditErr) {
                    logger.error(auditErr);
                    return responder({
                        tipo: 'danger',
                        texto: 'No fue posible registrar la auditoría del vaciado del carrito.',
                        redirectTo: '/concesionario/carrito'
                    });
                }

                return responder({
                    tipo: 'success',
                    texto: 'El carrito fue vaciado correctamente.',
                    redirectTo: '/concesionario/carrito'
                });
            }
        );
    } catch (error) {
        logger.error(error);
        registrarEvento(req, 'Error al vaciar el carrito de preventa');
        return responder({
            tipo: 'danger',
            texto: 'No fue posible vaciar el carrito. Intente nuevamente.',
            redirectTo: '/concesionario/carrito'
        });
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
            logger.error(campaniaErr);
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
                logger.error(sucursalesErr);
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
                        logger.error(productoErr);
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
                                logger.error(configErr);
                                registrarEvento(req, 'Error al obtener la ventana de cancelación configurada', usuario.correo);
                                req.session.mensaje = {
                                    tipo: 'danger',
                                    texto: 'No fue posible confirmar la reserva. Intente nuevamente.'
                                };
                                return res.redirect('/concesionario/carrito');
                            }

                            const minutosCancelacion = configuracion?.minutos_cancelacion || 15;
                            const fechaLimiteCancelacion = calcularFechaLimiteCancelacion(minutosCancelacion);

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
                                    logger.error(reservaErr);
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

                                notificarReservaConfirmada(req, {
                                    folio,
                                    correo: usuario.correo,
                                    idCuenta: cuentaActivaId
                                });

                                return res.redirect('/concesionario/carrito');
                            });
                        });
                    }
                });
            });
        });
    });
};
