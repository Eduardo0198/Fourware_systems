const cuentaModel = require('../models/cuenta.model');
const logger = require('../utils/logger');
const renderError = require('../utils/renderError');
const {
    registrarEvento,
    incrementarIntento
} = require('../utils/auditoria.helper');

function obtenerDescripcionAccesoSinSesion(ruta) {
    const rutaLimpia = (ruta || '').split('?')[0];

    const descripciones = {
        '/admin/auditoria': 'Intento de acceso sin sesión a bitácora de auditoría',
        '/admin/dashboard': 'Intento de acceso sin sesión a dashboard de administrador',
        '/admin/catalogo': 'Intento de acceso sin sesión a catálogo de administrador',
        '/admin/campanas': 'Intento de acceso sin sesión a campañas de administrador',
        '/admin/reportes': 'Intento de acceso sin sesión a reportes de administrador'
        
    };

    return descripciones[rutaLimpia] || `Intento de acceso sin sesión a ${rutaLimpia || 'ruta protegida'}`;
}

exports.protegerRuta = (req, res, next) => {
    if (!req.session.usuario) {
        const numeroIntento = incrementarIntento(req, 'acceso_sin_sesion');
        registrarEvento(
            req,
            `${obtenerDescripcionAccesoSinSesion(req.originalUrl)}. Intento numero ${numeroIntento}`,
            null
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
            const numeroIntento = incrementarIntento(req, 'acceso_no_autorizado_rol');
            registrarEvento(
                req,
                `Intento de acceso no autorizado por rol a ${req.path}. Intento numero ${numeroIntento}`
            );
            return renderError(res, 403, 'No tienes permiso para acceder a esta sección.', '/');
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
            const numeroIntento = incrementarIntento(req, 'acceso_sin_privilegio');
            registrarEvento(
                req,
                `Intento de acceso sin privilegio a ${req.path}. Intento numero ${numeroIntento}`
            );
            return renderError(res, 403, 'No tienes permiso para acceder a esta sección.', '/');
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
        const numeroIntento = incrementarIntento(req, 'operacion_sin_cuenta_activa');
        registrarEvento(
            req,
            `Intento de operación sin cuenta activa. Intento numero ${numeroIntento}`
        );
        req.session.mensaje = {
            tipo: 'warning',
            texto: 'Debes seleccionar una cuenta activa antes de operar en el sistema.'
        };
        return res.redirect('/concesionario/home');
    }

    cuentaModel.obtenerCuentaPorCorreoYId(usuario.correo, usuario.cuentaActiva.id_cuenta, (err, cuenta) => {
        if (err) {
            logger.error(err);
            registrarEvento(req, 'Error al validar cuenta activa');
            req.session.mensaje = {
                tipo: 'danger',
                texto: 'No fue posible validar la cuenta activa.'
            };
            return res.redirect('/concesionario/home');
        }

        if (!cuenta) {
            req.session.usuario.cuentaActiva = null;
            registrarEvento(req, 'Cuenta activa no asociada al usuario');
            req.session.mensaje = {
                tipo: 'danger',
                texto: 'La cuenta activa ya no esta asociada a tu usuario.'
            };
            return res.redirect('/concesionario/home');
        }

        if (!cuenta.activo) {
            req.session.usuario.cuentaActiva = null;
            const numeroIntento = incrementarIntento(req, 'operacion_con_cuenta_inactiva');
            registrarEvento(
                req,
                `Intento de operación con cuenta inactiva. Intento numero ${numeroIntento}`
            );
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
