const cuentaModel = require('../../models/cuenta.model');
const concesionarioModel = require('../../models/concesionario.model');
const reservaModel = require('../../models/reserva.model');
const logger = require('../../utils/logger');
const { registrarEvento } = require('../../utils/auditoria.helper');
const { obtenerContextoCuentaActiva, formatearFecha } = require('./shared');

function obtenerPrimerNombre(nombreCompleto) {
    if (!nombreCompleto) {
        return 'Concesionario';
    }

    return String(nombreCompleto).trim().split(/\s+/)[0];
}

exports.home = (req, res) => {
    const usuario = req.session.usuario || {};
    const cuentaActiva = usuario.cuentaActiva || null;
    const carrito = Array.isArray(req.session.carrito) ? req.session.carrito : [];
    const productosEnCarrito = carrito.reduce((acumulado, item) => acumulado + Number(item.cantidad || 0), 0);

    obtenerContextoCuentaActiva(req, (contextoErr, contexto) => {
        if (contextoErr) {
            logger.error(contextoErr);
            registrarEvento(req, 'Error al validar cuenta activa para inicio de concesionario');
            req.session.mensaje = {
                tipo: 'danger',
                texto: 'No fue posible cargar la información inicial del concesionario.'
            };
            return res.redirect('/concesionario/catalogo');
        }

        concesionarioModel.obtenerTopProductos((topErr, productosTop) => {
            if (topErr) {
                logger.error(topErr);
                registrarEvento(req, 'Error al consultar inicio de concesionario');
                req.session.mensaje = {
                    tipo: 'danger',
                    texto: 'No fue posible cargar el inicio del concesionario.'
                };
                return res.redirect('/concesionario/catalogo');
            }

            if (!contexto) {
                registrarEvento(req, 'Consulta de inicio de concesionario sin cuenta activa');
                return res.render('modules/concesionarioHome', {
                    saludo: obtenerPrimerNombre(usuario.nombre),
                    cuentaActiva,
                    mostrarBanner: true,
                    resumen: {
                        totalReservas: 0,
                        reservasConfirmadas: 0,
                        reservasCanceladas: 0,
                        ultimaReservaTexto: 'Sin actividad registrada',
                        productosEnCarrito
                    },
                    reservasRecientes: [],
                    productosTop: productosTop || []
                });
            }

            reservaModel.obtenerResumenPorCorreoYCuenta(contexto.correo, contexto.idCuenta, (resumenErr, resumenReserva) => {
                if (resumenErr) {
                    logger.error(resumenErr);
                    registrarEvento(req, 'Error al consultar resumen de reservas para inicio de concesionario');
                    req.session.mensaje = {
                        tipo: 'danger',
                        texto: 'No fue posible cargar el resumen del concesionario.'
                    };
                    return res.redirect('/concesionario/catalogo');
                }

                reservaModel.obtenerReservasRecientesPorCorreoYCuenta(
                    contexto.correo,
                    contexto.idCuenta,
                    5,
                    (recientesErr, reservasRecientes) => {
                        if (recientesErr) {
                            logger.error(recientesErr);
                            registrarEvento(req, 'Error al consultar reservas recientes para inicio de concesionario');
                            req.session.mensaje = {
                                tipo: 'danger',
                                texto: 'No fue posible cargar la actividad reciente del concesionario.'
                            };
                            return res.redirect('/concesionario/catalogo');
                        }

                        const reservasNormalizadas = (reservasRecientes || []).map((reserva) => ({
                            ...reserva,
                            estatusTexto: Number(reserva.estatus) === 1 ? 'Confirmada' : 'Cancelada',
                            estatusClase: Number(reserva.estatus) === 1 ? 'success' : 'secondary',
                            fechaTexto: formatearFecha(reserva.fecha),
                            totalTexto: Number(reserva.total || 0).toLocaleString('es-MX', {
                                style: 'currency',
                                currency: 'MXN'
                            })
                        }));

                        registrarEvento(req, 'Consulta de inicio de concesionario');

                        return res.render('modules/concesionarioHome', {
                            saludo: obtenerPrimerNombre(usuario.nombre),
                            cuentaActiva,
                            mostrarBanner: true,
                            resumen: {
                                totalReservas: Number(resumenReserva.total_reservas || 0),
                                reservasConfirmadas: Number(resumenReserva.reservas_confirmadas || 0),
                                reservasCanceladas: Number(resumenReserva.reservas_canceladas || 0),
                                ultimaReservaTexto: resumenReserva.ultima_reserva_fecha
                                    ? formatearFecha(resumenReserva.ultima_reserva_fecha, true)
                                    : 'Sin actividad registrada',
                                productosEnCarrito
                            },
                            reservasRecientes: reservasNormalizadas,
                            productosTop: productosTop || []
                        });
                    }
                );
            });
        });
    });
};

exports.seleccionarCuentaActiva = (req, res) => {
    const usuario = req.session.usuario;
    const idCuenta = parseInt(req.body.id_cuenta, 10);
    const destino = req.get('referer') || '/concesionario/home';
    const cuentaAnteriorId = usuario?.cuentaActiva?.id_cuenta || null;
    const esAjax = req.headers['x-requested-with'] === 'XMLHttpRequest';

    const respError = (texto, status = 400) => {
        if (esAjax) return res.status(status).json({ ok: false, mensaje: texto });
        req.session.mensaje = { tipo: 'danger', texto };
        return res.redirect(destino);
    };

    if (!usuario || !usuario.correo || Number.isNaN(idCuenta)) return respError('No fue posible actualizar la cuenta activa.');

    cuentaModel.obtenerCuentaPorCorreoYId(usuario.correo, idCuenta, (err, cuenta) => {
        if (err) {
            logger.error(err);
            return respError('No fue posible actualizar la cuenta activa.', 500);
        }

        if (!cuenta) return respError('La cuenta seleccionada no está asociada a tu usuario.');

        if (!cuenta.activo) {
            registrarEvento(req, `Intento de seleccionar cuenta inactiva ${cuenta.id_cuenta} - ${cuenta.nombre}`, usuario.correo);
            if (esAjax) return res.status(400).json({ ok: false, mensaje: 'Esta cuenta está inactiva.' });
            req.session.mensaje = { tipo: 'warning', texto: 'Esta cuenta está inactiva.' };
            return res.redirect(destino);
        }

        cuentaModel.obtenerCuentasPorCorreo(usuario.correo, (errCuentas, cuentas) => {
            if (errCuentas) {
                logger.error(errCuentas);
                return respError('No fue posible actualizar la cuenta activa.', 500);
            }

            req.session.usuario.cuentas = cuentas;
            req.session.usuario.cuentaActiva = cuentas.find(item => item.id_cuenta === cuenta.id_cuenta) || cuenta;
            req.session.carritoCuentaId = cuenta.id_cuenta;

            const carritoReset = !!(cuentaAnteriorId && cuentaAnteriorId !== cuenta.id_cuenta);
            if (carritoReset) req.session.carrito = [];

            registrarEvento(req, `Seleccionó la cuenta activa ${cuenta.id_cuenta} - ${cuenta.nombre}`, usuario.correo);

            if (esAjax) {
                return res.json({
                    ok: true,
                    mensaje: `Ahora estás operando con la cuenta ${cuenta.nombre}.`,
                    cuenta: { nombre: cuenta.nombre, codigo: cuenta.codigo, estatus: cuenta.estatus },
                    carritoReset
                });
            }

            req.session.mensaje = { tipo: 'success', texto: `Ahora estás operando con la cuenta ${cuenta.nombre}.` };
            return res.redirect(destino);
        });
    });
};
