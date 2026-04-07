const cuentaModel = require('../../models/cuenta.model');
const concesionarioModel = require('../../models/concesionario.model');
const campaniaModel = require('../../models/campania.model');
const { registrarEvento } = require('../../utils/auditoria.helper');

exports.home = (req, res) => {
    concesionarioModel.obtenerTopProductos((err, productos) => {
        if (err) {
            console.error(err);
            registrarEvento(req, 'Error al consultar inicio de concesionario');
            return res.send('Error al obtener productos');
        }

        campaniaModel.obtenerCampaniaActiva((err2, result) => {
            if (err2) {
                console.error(err2);
            }

            const campania = (result && result.length > 0) ? result[0] : null;
            registrarEvento(req, 'Consulta de inicio de concesionario');

            return res.render('modules/concesionarioHome', {
                productos,
                campania
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
