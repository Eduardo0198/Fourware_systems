const db = require('../config/db');
const concesionarioModel = require('../models/concesionario.model');
const campaniaModel = require('../models/campania.model');
const cuentaModel = require('../models/cuenta.model');
const bitacora = require('../models/bitacora.model');
const calificacionModel = require('../models/calificacion.model');
const reservaModel = require('../models/reserva.model');
const cancelacionModel = require('../models/cancelacion.model');
const { registrarEvento } = require('../utils/auditoria.helper');

// inicio ---- fabrizio ----- helpersCancelacionReservas --

function formatearFecha(valor, incluirHora = false) {
    if (!valor) {
        return 'No disponible';
    }

    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) {
        return String(valor);
    }

    return fecha.toLocaleString('es-MX', incluirHora
        ? {
            dateStyle: 'medium',
            timeStyle: 'short'
        }
        : {
            dateStyle: 'medium'
        });
}

function normalizarReserva(reserva, horasCancelacion = 24) {
    const estatusNumerico = Number(reserva.estatus);
    const fechaLimite = reserva.fecha_cancelacion_reserva
        ? new Date(reserva.fecha_cancelacion_reserva)
        : null;
    const fechaActual = new Date();
    const limiteValida = fechaLimite && !Number.isNaN(fechaLimite.getTime());
    const cancelacionDisponible = estatusNumerico === 1
        && limiteValida
        && fechaActual <= fechaLimite;

    return {
        ...reserva,
        estatusNumerico,
        estatusTexto: estatusNumerico === 0 ? 'Cancelada' : 'Confirmada',
        estatusClase: estatusNumerico === 0 ? 'danger' : 'success',
        horasCancelacion,
        fechaTexto: formatearFecha(reserva.fecha),
        fechaCancelacionTexto: formatearFecha(reserva.fecha_cancelacion_reserva, true),
        fechaSucursalTexto: reserva.nombre_sucursal
            ? `${reserva.nombre_sucursal}`
            : 'Sucursal no disponible',
        puedeCancelar: cancelacionDisponible,
        cancelacionExpirada: estatusNumerico === 1 && !cancelacionDisponible,
        direccionSucursal: [
            reserva.direccion,
            reserva.municipio,
            reserva.estado
        ].filter(Boolean).join(', ')
    };
}

function obtenerReservaNormalizada(folio, correo, idCuenta, callback) {
    cancelacionModel.obtener((configErr, configuracion) => {
        if (configErr) {
            return callback(configErr);
        }

        reservaModel.obtenerDetallePorFolioCorreoYCuenta(folio, correo, idCuenta, (reservaErr, reserva) => {
            if (reservaErr) {
                return callback(reservaErr);
            }

            if (!reserva) {
                return callback(null, null);
            }

            callback(null, normalizarReserva(reserva, configuracion?.horas_cancelacion || 24));
        });
    });
}

// fin ---- fabrizio----------

function construirConsultaCatalogo(req) {
    return {
        page: parseInt(req.query.page, 10) || 1,
        limit: parseInt(req.query.limit, 10) || 12,
        searchTerm: String(req.query.q || '').trim(),
        precioMin: req.query.precio_min ? parseFloat(req.query.precio_min) : 0,
        precioMax: req.query.precio_max ? parseFloat(req.query.precio_max) : 10000,
        unidadVenta: String(req.query.unidad_venta || '').trim()
    };
}

function tieneBusquedaOFiltros(req, searchTerm, unidadVenta) {
    return (
        searchTerm !== ''
        || typeof req.query.precio_min !== 'undefined'
        || typeof req.query.precio_max !== 'undefined'
        || unidadVenta !== ''
    );
}

function obtenerDatosCatalogo(req, callback) {
    const {
        page,
        limit,
        searchTerm,
        precioMin,
        precioMax,
        unidadVenta
    } = construirConsultaCatalogo(req);

    campaniaModel.obtenerCampaniaActiva((campaniaErr, campanias) => {
        if (campaniaErr) {
            return callback(campaniaErr);
        }

        const campaniaActiva = Array.isArray(campanias) && campanias.length > 0
            ? campanias[0]
            : null;

        if (!campaniaActiva) {
            return callback(null, {
                campaniaActiva: null,
                productos: [],
                unidadesVenta: [],
                paginacion: {
                    paginaActual: 1,
                    totalPaginas: 0
                },
                query: searchTerm,
                precio_min: precioMin,
                precio_max: precioMax,
                unidad_venta_seleccionada: unidadVenta,
                hayBusquedaOFiltros: tieneBusquedaOFiltros(req, searchTerm, unidadVenta)
            });
        }

        concesionarioModel.obtenerProductosPaginados(
            page,
            limit,
            searchTerm,
            precioMin,
            precioMax,
            unidadVenta,
            campaniaActiva.id_campania,
            (productosErr, result) => {
                if (productosErr) {
                    return callback(productosErr);
                }

                const { productos, total } = result;
                const totalPaginas = Math.ceil(total / limit);

                concesionarioModel.obtenerUnidadesVenta(campaniaActiva.id_campania, (unidadesErr, unidadesVenta) => {
                    if (unidadesErr) {
                        return callback(unidadesErr);
                    }

                    return callback(null, {
                        campaniaActiva,
                        productos,
                        unidadesVenta,
                        paginacion: {
                            paginaActual: page,
                            totalPaginas
                        },
                        query: searchTerm,
                        precio_min: precioMin,
                        precio_max: precioMax,
                        unidad_venta_seleccionada: unidadVenta,
                        hayBusquedaOFiltros: tieneBusquedaOFiltros(req, searchTerm, unidadVenta)
                    });
                });
            }
        );
    });
}

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
    const cuentaAnteriorId = usuario?.cuentaActiva?.id_cuenta || null;

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
            bitacora.registrar(
                usuario.correo,
                `Intento de seleccionar cuenta inactiva ${cuenta.id_cuenta} - ${cuenta.nombre}`,
                req.ip
            );
            req.session.mensaje = {
                tipo: 'warning',
                texto: 'Esta cuenta está inactiva.'
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
            req.session.carritoCuentaId = cuenta.id_cuenta;

            if (cuentaAnteriorId && cuentaAnteriorId !== cuenta.id_cuenta) {
                req.session.carrito = [];
            }

            bitacora.registrar(
                usuario.correo,
                `Seleccionó la cuenta activa ${cuenta.id_cuenta} - ${cuenta.nombre}`,
                req.ip
            );

            req.session.mensaje = {
                tipo: 'success',
                texto: `Ahora estás operando con la cuenta ${cuenta.nombre}.`
            };

            return res.redirect(destino);
        });
    });
};

exports.catalogo = (req, res) => {
    obtenerDatosCatalogo(req, (err, data) => {
        if (err) {
            console.log(err);
            registrarEvento(req, 'Error al consultar catálogo de productos');
            return res.send("Error al obtener catálogo");
        }

        if (!data.campaniaActiva) {
            registrarEvento(req, 'Intento de consulta de catálogo sin campaña vigente');
            return res.render('modules/concesionarioCatalogo', {
                ...data,
                pageMessage: {
                    tipo: 'warning',
                    texto: 'No existe una campaña de preventa vigente.'
                }
            });
        }

        registrarEvento(
            req,
            data.query
                ? 'Búsqueda de productos mediante buscador predictivo'
                : 'Consulta de catálogo de productos'
        );

        return res.render('modules/concesionarioCatalogo', {
            ...data,
            pageMessage: null
        });
    });
};

exports.catalogoPredictivo = (req, res) => {
    req.query.page = '1';
    req.query.limit = '12';

    obtenerDatosCatalogo(req, (err, data) => {
        if (err) {
            console.log(err);
            registrarEvento(req, 'Error en búsqueda predictiva de catálogo');
            return res.status(500).json({
                ok: false,
                mensaje: 'No fue posible realizar la búsqueda.'
            });
        }

        if (!data.campaniaActiva) {
            registrarEvento(req, 'Intento de búsqueda predictiva sin campaña vigente');
            return res.status(409).json({
                ok: false,
                mensaje: 'No existe una campaña de preventa vigente.',
                productos: [],
                paginacion: {
                    paginaActual: 1,
                    totalPaginas: 0
                }
            });
        }

        registrarEvento(
            req,
            data.query
                ? 'Búsqueda predictiva de productos en catálogo'
                : 'Consulta predictiva de catálogo de productos'
        );

        return res.json({
            ok: true,
            productos: data.productos,
            paginacion: data.paginacion,
            query: data.query,
            precio_min: data.precio_min,
            precio_max: data.precio_max,
            unidad_venta_seleccionada: data.unidad_venta_seleccionada,
            hayBusquedaOFiltros: data.hayBusquedaOFiltros
        });
    });
};

exports.producto = (req, res) => {
    const sku = req.params.sku;

    campaniaModel.obtenerCampaniaActiva((campaniaErr, campanias) => {
        if (campaniaErr) {
            console.log(campaniaErr);
            registrarEvento(req, 'Error al validar campaña vigente para detalle de producto');
            req.session.mensaje = {
                tipo: 'danger',
                texto: 'Error en la consulta.'
            };
            return res.redirect('/concesionario/catalogo');
        }

        const campaniaActiva = Array.isArray(campanias) && campanias.length > 0
            ? campanias[0]
            : null;

        if (!campaniaActiva) {
            registrarEvento(req, 'Intento de consulta de detalle sin campaña vigente');
            req.session.mensaje = {
                tipo: 'warning',
                texto: 'La campaña de preventa no se encuentra disponible en este momento.'
            };
            return res.redirect('/concesionario/catalogo');
        }

        concesionarioModel.obtenerProductoActivoPorSkuYCampania(
            sku,
            campaniaActiva.id_campania,
            (err, producto) => {
                if (err) {
                    console.log(err);
                    registrarEvento(req, 'Error al consultar detalle técnico y logístico de producto');
                    req.session.mensaje = {
                        tipo: 'danger',
                        texto: 'Error en la consulta.'
                    };
                    return res.redirect('/concesionario/catalogo');
                }

                if (!producto) {
                    registrarEvento(req, 'Intento de consulta de producto no disponible');
                    req.session.mensaje = {
                        tipo: 'warning',
                        texto: 'El producto seleccionado ya no se encuentra disponible.'
                    };
                    return res.redirect('/concesionario/catalogo');
                }

                // inicio ---- fabrizio ----- detalleProductoConResenas --
                calificacionModel.obtenerResumenCalificacionesPorSku(sku, (errResumen, resumenCalificaciones) => {
                    if (errResumen) {
                        console.log(errResumen);
                        registrarEvento(req, 'Error al consultar resumen de reseñas del producto');
                        req.session.mensaje = {
                            tipo: 'danger',
                            texto: 'Error en la consulta.'
                        };
                        return res.redirect('/concesionario/catalogo');
                    }

                    calificacionModel.obtenerResenasPorSku(sku, (errResenas, resenas) => {
                        if (errResenas) {
                            console.log(errResenas);
                            registrarEvento(req, 'Error al consultar reseñas del producto');
                            req.session.mensaje = {
                                tipo: 'danger',
                                texto: 'Error en la consulta.'
                            };
                            return res.redirect('/concesionario/catalogo');
                        }

                        const totalResenas = resumenCalificaciones.total_resenas || 0;
                        const distribucionConPorcentaje = [5, 4, 3, 2, 1].map((estrella) => {
                            const total = resumenCalificaciones.distribucion[estrella] || 0;
                            return {
                                estrella,
                                total,
                                porcentaje: totalResenas > 0
                                    ? Math.round((total / totalResenas) * 100)
                                    : 0
                            };
                        });

                        registrarEvento(req, 'Consulta de detalle técnico y logístico de producto');
                        return res.render('modules/concesionarioProducto', {
                            producto,
                            resumenCalificaciones,
                            distribucionConPorcentaje,
                            resenas: Array.isArray(resenas) ? resenas : []
                        });
                    });
                });
                // fin ---- fabrizio----------
            }
        );
    });
};


exports.confirmarReserva = (req, res) => {
    // inicio caso 8 lau
    registrarEvento(req, 'Consulta de confirmación de reserva');
    // fin caso 8 lau
    res.render('modules/concesionarioConfirmarReserva');
};

exports.reservas = (req, res) => {
    const correo = req.session.usuario?.correo;
    const idCuenta = req.session.usuario?.cuentaActiva?.id_cuenta;

    cancelacionModel.obtener((configErr, configuracion) => {
        if (configErr) {
            console.error(configErr);
            req.session.mensaje = {
                tipo: 'danger',
                texto: 'No fue posible consultar la configuración de cancelación.'
            };
            return res.render('modules/concesionarioReservas', { reservas: [] });
        }

        reservaModel.obtenerReservasPorCorreoYCuenta(correo, idCuenta, (err, reservas) => {
            if (err) {
                console.error(err);
                req.session.mensaje = {
                    tipo: 'danger',
                    texto: 'No fue posible consultar tus reservas.'
                };
                return res.render('modules/concesionarioReservas', { reservas: [] });
            }

            // inicio caso 8 lau
            registrarEvento(req, 'Consulta de historial de reservas');
            // fin caso 8 lau
            res.render('modules/concesionarioReservas', {
                reservas: (reservas || []).map((item) =>
                    normalizarReserva(item, configuracion?.horas_cancelacion || 24)
                )
            });
        });
    });
};

exports.detalleReserva = (req, res) => {
    const folio = req.params.folio;
    const correo = req.session.usuario?.correo;
    const idCuenta = req.session.usuario?.cuentaActiva?.id_cuenta;

    obtenerReservaNormalizada(folio, correo, idCuenta, (err, reserva) => {
        if (err) {
            console.error(err);
            req.session.mensaje = {
                tipo: 'danger',
                texto: 'No fue posible consultar el detalle de la reserva.'
            };
            return res.redirect('/concesionario/reservas');
        }

        if (!reserva) {
            req.session.mensaje = {
                tipo: 'warning',
                texto: 'La reserva seleccionada no existe para la cuenta activa.'
            };
            return res.redirect('/concesionario/reservas');
        }

        // inicio caso 8 lau
        registrarEvento(req, 'Consulta de detalle de reserva');
        // fin caso 8 lau
        res.render('modules/concesionarioDetalleReserva', {
            reserva
        });
    });
};

exports.cancelarReserva = (req, res) => {
    const folio = String(req.query.folio || '').trim();
    const correo = req.session.usuario?.correo;
    const idCuenta = req.session.usuario?.cuentaActiva?.id_cuenta;

    if (!folio) {
        req.session.mensaje = {
            tipo: 'warning',
            texto: 'Debes seleccionar una reserva válida para cancelarla.'
        };
        return res.redirect('/concesionario/reservas');
    }

    obtenerReservaNormalizada(folio, correo, idCuenta, (err, reserva) => {
        if (err) {
            console.error(err);
            req.session.mensaje = {
                tipo: 'danger',
                texto: 'No fue posible consultar la reserva a cancelar.'
            };
            return res.redirect('/concesionario/reservas');
        }

        if (!reserva) {
            req.session.mensaje = {
                tipo: 'warning',
                texto: 'La reserva seleccionada no existe para la cuenta activa.'
            };
            return res.redirect('/concesionario/reservas');
        }

        // inicio caso 8 lau
        registrarEvento(req, 'Consulta de cancelación de reserva');
        // fin caso 8 lau
        res.render('modules/concesionarioCancelarReserva', {
            reserva
        });
    });
};

// inicio ---- fabrizio ----- confirmarCancelacionReserva --

exports.cancelarReservaPost = (req, res) => {
    const folio = String(req.body.folio || '').trim();
    const correo = req.session.usuario?.correo;
    const idCuenta = req.session.usuario?.cuentaActiva?.id_cuenta;

    if (!folio) {
        req.session.mensaje = {
            tipo: 'warning',
            texto: 'No fue posible identificar la reserva a cancelar.'
        };
        return res.redirect('/concesionario/reservas');
    }

    obtenerReservaNormalizada(folio, correo, idCuenta, (err, reserva) => {
        if (err) {
            console.error(err);
            req.session.mensaje = {
                tipo: 'danger',
                texto: 'No fue posible validar la reserva a cancelar.'
            };
            return res.redirect('/concesionario/reservas');
        }

        if (!reserva) {
            req.session.mensaje = {
                tipo: 'warning',
                texto: 'La reserva seleccionada no existe para la cuenta activa.'
            };
            return res.redirect('/concesionario/reservas');
        }

        if (!reserva.puedeCancelar) {
            registrarEvento(req, 'Intento de cancelación fuera de ventana permitida');
            req.session.mensaje = {
                tipo: 'warning',
                texto: 'La ventana de cancelación para esta reserva ya expiró o la reserva ya fue cancelada.'
            };
            return res.redirect(`/concesionario/reserva/${folio}`);
        }

        reservaModel.cancelarReserva(folio, correo, idCuenta, (cancelErr, result) => {
            if (cancelErr) {
                console.error(cancelErr);
                registrarEvento(req, 'Error al cancelar reserva');
                req.session.mensaje = {
                    tipo: 'danger',
                    texto: 'No fue posible cancelar la reserva. Intente nuevamente.'
                };
                return res.redirect(`/concesionario/reserva/${folio}`);
            }

            if (!result || result.affectedRows === 0) {
                req.session.mensaje = {
                    tipo: 'warning',
                    texto: 'La reserva ya no se encuentra disponible para cancelación.'
                };
                return res.redirect(`/concesionario/reserva/${folio}`);
            }

            registrarEvento(req, `Cancelación de reserva ${folio}`);
            req.session.mensaje = {
                tipo: 'success',
                texto: `La reserva ${folio} fue cancelada correctamente.`
            };
            return res.redirect('/concesionario/reservas');
        });
    });
};

// fin ---- fabrizio----------

// inicio ---- lau ----- calificarProducto --

exports.calificarProducto = (req, res) => {
    const sku = req.params.sku || req.body.sku;
    const { calificacion, comentario } = req.body;
    const correo = req.session.usuario?.correo;

    if (!sku) {
        req.session.mensaje = {
            tipo: 'danger',
            texto: 'No fue posible identificar el producto a calificar.'
        };
        return res.redirect('/concesionario/catalogo');
    }

    if (!calificacion || calificacion < 1 || calificacion > 5) {
        req.session.mensaje = {
            tipo: 'danger',
            texto: 'Calificación inválida. Debe ser entre 1 y 5.'
        };
        return res.redirect(`/concesionario/producto/${sku}`);
    }

    calificacionModel.registrarCalificacion(correo, sku, calificacion, comentario || '', (err) => {
        if (err) {
            console.error(err);
            registrarEvento(req, 'Error al registrar calificación de producto');
            req.session.mensaje = {
                tipo: 'danger',
                texto: 'Error al registrar la calificación.'
            };
        } else {
            registrarEvento(req, 'Registro de calificación y comentario sobre producto de preventa');
            req.session.mensaje = {
                tipo: 'success',
                texto: 'Calificación registrada exitosamente.'
            };
        }
        res.redirect(`/concesionario/producto/${sku}`);
    });
};

// fin ---- lau----------
