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
    //CU03-Paso 4:
    //El controlador recibe el id_cuenta seleccionado desde la vista
    //y coordina la validación, actualización de sesión y auditoría.
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

    //CU03-Paso 5:
    //Primero valida que la cuenta elegida pertenezca al usuario
    //y consulta su estado actual en la base de datos.
    cuentaModel.obtenerCuentaPorCorreoYId(usuario.correo, idCuenta, (err, cuenta) => {
        if (err) {
            logger.error(err);
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
            //CU03-Flujo alternativo malo 2:
            //Si la cuenta está inactiva, se registra el intento y se mantiene
            //la cuenta activa anterior sin aplicar cambios.
            registrarEvento(
                req,
                `Intento de seleccionar cuenta inactiva ${cuenta.id_cuenta} - ${cuenta.nombre}`,
                usuario.correo
            );
            req.session.mensaje = {
                tipo: 'warning',
                texto: 'Esta cuenta está inactiva.'
            };
            return res.redirect(destino);
        }

        //CU03-Paso 6:
        //Si la cuenta es válida, se recarga el listado completo de cuentas
        //para sincronizar la sesión con la información actualizada del usuario.
        cuentaModel.obtenerCuentasPorCorreo(usuario.correo, (errCuentas, cuentas) => {
            if (errCuentas) {
                logger.error(errCuentas);
                req.session.mensaje = {
                    tipo: 'danger',
                    texto: 'No fue posible actualizar la cuenta activa.'
                };
                return res.redirect(destino);
            }

            //CU03-Paso 7:
            //Se actualizan en sesión las cuentas disponibles, la nueva cuenta activa
            //y el id de la cuenta activa para que el carrito opere en el contexto correcto.
            req.session.usuario.cuentas = cuentas;
            req.session.usuario.cuentaActiva =
                cuentas.find(item => item.id_cuenta === cuenta.id_cuenta) || cuenta;
            req.session.carritoCuentaId = cuenta.id_cuenta;

            if (cuentaAnteriorId && cuentaAnteriorId !== cuenta.id_cuenta) {
                //CU03-Paso 8:
                //Si se cambió la cuenta activa, el carrito se limpia para no mezclar
                //productos capturados bajo otra cuenta.
                req.session.carrito = [];
            }

            //CU03-Paso 9:
            //El cambio exitoso de cuenta se registra en bitácora antes de redirigir.
            registrarEvento(
                req,
                `Seleccionó la cuenta activa ${cuenta.id_cuenta} - ${cuenta.nombre}`,
                usuario.correo
            );

            req.session.mensaje = {
                tipo: 'success',
                texto: `Ahora estás operando con la cuenta ${cuenta.nombre}.`
            };

            return res.redirect(destino);
        });
    });
};
