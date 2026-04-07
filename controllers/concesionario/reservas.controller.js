const reservaModel = require('../../models/reserva.model');
const { registrarEvento } = require('../../utils/auditoria.helper');
const logger = require('../../utils/logger');
const { generarPdfReserva } = require('../../services/pdf.service');
const {
    MENSAJE_CANCELACION_EXITOSA,
    MENSAJE_CANCELACION_FUERA_DE_PLAZO,
    MENSAJE_ERROR_CANCELACION,
    MENSAJE_RESERVA_INVALIDA,
    normalizarReserva,
    obtenerContextoCuentaActiva,
    obtenerReservaNormalizada,
    renderHistorialReservas,
    validarReservaCancelable
} = require('./shared');
const cancelacionModel = require('../../models/cancelacion.model');

exports.reservas = (req, res) => {
    obtenerContextoCuentaActiva(req, (contextoErr, contexto) => {
        if (contextoErr) {
            logger.error(contextoErr);
            registrarEvento(req, 'Error al validar cuenta activa para historial de reservas');
            req.session.mensaje = {
                tipo: 'danger',
                texto: 'No fue posible consultar el historial de reservas. Intente nuevamente.'
            };
            return res.redirect('/concesionario/home');
        }

        if (!contexto) {
            req.session.mensaje = {
                tipo: 'warning',
                texto: 'No fue posible identificar una cuenta activa para el usuario.'
            };
            return res.redirect('/concesionario/home');
        }

        const { correo, idCuenta } = contexto;

        cancelacionModel.obtener((configErr, configuracion) => {
            if (configErr) {
                logger.error(configErr);
                registrarEvento(req, 'Error al consultar historial de reservas');
                return renderHistorialReservas(res, [], {
                    tipo: 'danger',
                    texto: 'No fue posible consultar el historial de reservas. Intente nuevamente.'
                });
            }

            reservaModel.obtenerReservasPorCorreoYCuenta(correo, idCuenta, (err, reservas) => {
                if (err) {
                    logger.error(err);
                    registrarEvento(req, 'Error al consultar historial de reservas');
                    return renderHistorialReservas(res, [], {
                        tipo: 'danger',
                        texto: 'No fue posible consultar el historial de reservas. Intente nuevamente.'
                    });
                }

                const reservasNormalizadas = (reservas || []).map((item) =>
                    normalizarReserva(item, configuracion?.horas_cancelacion || 24)
                );

                if (reservasNormalizadas.length === 0) {
                    registrarEvento(req, 'Consulta de historial de reservas sin registros');
                    return renderHistorialReservas(res, [], {
                        tipo: 'info',
                        texto: 'No existen reservas registradas para la cuenta activa.'
                    });
                }

                registrarEvento(req, 'Consulta de historial de reservas');
                return renderHistorialReservas(res, reservasNormalizadas);
            });
        });
    });
};

exports.detalleReserva = (req, res) => {
    const folio = req.params.folio;

    obtenerContextoCuentaActiva(req, (contextoErr, contexto) => {
        if (contextoErr) {
            logger.error(contextoErr);
            registrarEvento(req, `Error al validar cuenta activa para detalle de reserva ${folio}`);
            req.session.mensaje = {
                tipo: 'danger',
                texto: 'No fue posible consultar el detalle de la reserva.'
            };
            return res.redirect('/concesionario/home');
        }

        if (!contexto) {
            req.session.mensaje = {
                tipo: 'warning',
                texto: 'No fue posible identificar una cuenta activa para el usuario.'
            };
            return res.redirect('/concesionario/home');
        }

        const { correo, idCuenta } = contexto;

        obtenerReservaNormalizada(folio, correo, idCuenta, (err, reserva) => {
            if (err) {
                logger.error(err);
                registrarEvento(req, `Error al consultar detalle de reserva ${folio}`);
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

            registrarEvento(req, `Consulta de detalle de reserva ${folio}`);
            return res.render('modules/concesionarioDetalleReserva', { reserva });
        });
    });
};

exports.descargarReservaPdf = (req, res) => {
    const folio = req.params.folio;

    obtenerContextoCuentaActiva(req, (contextoErr, contexto) => {
        if (contextoErr) {
            logger.error(contextoErr);
            registrarEvento(req, `Error al validar cuenta activa para PDF de reserva ${folio}`);
            req.session.mensaje = {
                tipo: 'danger',
                texto: 'No fue posible generar el PDF de la reserva.'
            };
            return res.redirect('/concesionario/home');
        }

        if (!contexto) {
            req.session.mensaje = {
                tipo: 'warning',
                texto: 'No fue posible identificar una cuenta activa para el usuario.'
            };
            return res.redirect('/concesionario/home');
        }

        const { correo, idCuenta } = contexto;

        obtenerReservaNormalizada(folio, correo, idCuenta, (err, reserva) => {
            if (err) {
                logger.error(err);
                registrarEvento(req, `Error al consultar detalle para PDF de reserva ${folio}`);
                req.session.mensaje = {
                    tipo: 'danger',
                    texto: 'No fue posible generar el PDF de la reserva.'
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

            registrarEvento(req, `Descargó PDF de la reserva ${folio}`);
            return generarPdfReserva(res, reserva);
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
            texto: MENSAJE_RESERVA_INVALIDA
        };
        return res.redirect('/concesionario/reservas');
    }

    obtenerReservaNormalizada(folio, correo, idCuenta, (err, reserva) => {
        if (err) {
            logger.error(err);
            req.session.mensaje = {
                tipo: 'danger',
                texto: 'No fue posible consultar la reserva a cancelar.'
            };
            return res.redirect('/concesionario/reservas');
        }

        if (!reserva) {
            req.session.mensaje = {
                tipo: 'warning',
                texto: MENSAJE_RESERVA_INVALIDA
            };
            return res.redirect('/concesionario/reservas');
        }

        const validacion = validarReservaCancelable(reserva);
        if (!validacion.valida) {
            req.session.mensaje = {
                tipo: 'warning',
                texto: validacion.mensaje
            };
            return res.redirect(`/concesionario/reserva/${folio}`);
        }

        registrarEvento(req, `Consulta de cancelación de reserva ${folio}`);
        return res.render('modules/concesionarioCancelarReserva', { reserva });
    });
};

exports.cancelarReservaPost = (req, res) => {
    const folio = String(req.body.folio || '').trim();
    const correo = req.session.usuario?.correo;
    const idCuenta = req.session.usuario?.cuentaActiva?.id_cuenta;

    if (!folio) {
        req.session.mensaje = {
            tipo: 'warning',
            texto: MENSAJE_RESERVA_INVALIDA
        };
        return res.redirect('/concesionario/reservas');
    }

    obtenerReservaNormalizada(folio, correo, idCuenta, (err, reserva) => {
        if (err) {
            logger.error(err);
            req.session.mensaje = {
                tipo: 'danger',
                texto: 'No fue posible validar la reserva a cancelar.'
            };
            return res.redirect('/concesionario/reservas');
        }

        if (!reserva) {
            req.session.mensaje = {
                tipo: 'warning',
                texto: MENSAJE_RESERVA_INVALIDA
            };
            return res.redirect('/concesionario/reservas');
        }

        const validacion = validarReservaCancelable(reserva);
        if (!validacion.valida) {
            if (validacion.mensaje === MENSAJE_CANCELACION_FUERA_DE_PLAZO) {
                registrarEvento(req, `Intento de cancelación fuera de plazo para la reserva ${folio}`);
            }
            req.session.mensaje = {
                tipo: 'warning',
                texto: validacion.mensaje
            };
            return res.redirect(`/concesionario/reserva/${folio}`);
        }

        reservaModel.cancelarReserva(folio, correo, idCuenta, (cancelErr, result) => {
            if (cancelErr) {
                logger.error(cancelErr);
                registrarEvento(req, 'Error al cancelar reserva');
                req.session.mensaje = {
                    tipo: 'danger',
                    texto: MENSAJE_ERROR_CANCELACION
                };
                return res.redirect(`/concesionario/reserva/${folio}`);
            }

            if (!result || result.affectedRows === 0) {
                req.session.mensaje = {
                    tipo: 'warning',
                    texto: MENSAJE_RESERVA_INVALIDA
                };
                return res.redirect(`/concesionario/reserva/${folio}`);
            }

            registrarEvento(req, `Cancelación de reserva ${folio}`);
            req.session.mensaje = {
                tipo: 'success',
                texto: MENSAJE_CANCELACION_EXITOSA
            };
            return res.redirect('/concesionario/reservas');
        });
    });
};
