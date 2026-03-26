const bitacora = require('../models/bitacora.model');
const cuentaModel = require('../models/cuenta.model');

exports.protegerRuta = (req, res, next) => {
    if (!req.session.usuario) {
        bitacora.registrar(
            null,
            `Intento de acceso sin sesión a ${req.originalUrl}`,
            req.ip
        );
        req.session.mensaje = {
            tipo: 'danger',
            texto: 'Tu sesión no está vigente. Inicia sesión nuevamente.'
        };
        return res.redirect('/');
    }
    next();
};

exports.tieneRol = (rolesPermitidos) => {
    return (req, res, next) => {
        const usuario = req.session.usuario;
        if (!usuario) {
            return res.redirect('/');
        }
        const tiene = usuario.roles.some(r =>
            rolesPermitidos.includes(r)
        );
        if (!tiene) {
            return res.send("Acceso denegado");
        }
        next();
    };
};

exports.tienePrivilegio = (privilegiosPermitidos) => {
    return (req, res, next) => {
        const usuario = req.session.usuario;
        if (!usuario) {
            return res.redirect('/');
        }
        const tiene = usuario.privilegios.some(p =>
            privilegiosPermitidos.includes(p)
        );
        if (!tiene) {
            return res.send("No tienes permiso");
        }
        next();
    };
};

exports.requiereCuentaActiva = (req, res, next) => {
    const usuario = req.session.usuario;

    if (!usuario || !Array.isArray(usuario.roles) || !usuario.roles.includes('Concesionario')) {
        return next();
    }

    if (!usuario.cuentaActiva || !usuario.cuentaActiva.id_cuenta) {
        req.session.mensaje = {
            tipo: 'warning',
            texto: 'Debes seleccionar una cuenta activa antes de operar en el sistema.'
        };
        return res.redirect('/concesionario/home');
    }

    cuentaModel.obtenerCuentaPorCorreoYId(usuario.correo, usuario.cuentaActiva.id_cuenta, (err, cuenta) => {
        if (err) {
            console.error(err);
            req.session.mensaje = {
                tipo: 'danger',
                texto: 'No fue posible validar la cuenta activa.'
            };
            return res.redirect('/concesionario/home');
        }

        if (!cuenta) {
            req.session.usuario.cuentaActiva = null;
            req.session.mensaje = {
                tipo: 'danger',
                texto: 'La cuenta activa ya no esta asociada a tu usuario.'
            };
            return res.redirect('/concesionario/home');
        }

        if (!cuenta.activo) {
            req.session.usuario.cuentaActiva = null;
            req.session.mensaje = {
                tipo: 'warning',
                texto: 'La cuenta activa se encuentra inactiva. Selecciona otra para continuar.'
            };
            return res.redirect('/concesionario/home');
        }

        req.session.usuario.cuentaActiva = cuenta;

        if (Array.isArray(req.session.usuario.cuentas)) {
            req.session.usuario.cuentas = req.session.usuario.cuentas.map(item =>
                item.id_cuenta === cuenta.id_cuenta ? cuenta : item
            );
        }

        next();
    });
};
