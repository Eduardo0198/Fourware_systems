const bitacora = require('../models/bitacora.model');

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
