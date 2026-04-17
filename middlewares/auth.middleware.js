const cuentaModel = require('../models/cuenta.model');
const logger = require('../utils/logger');
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
            const numeroIntento = incrementarIntento(req, 'acceso_sin_privilegio');
            registrarEvento(
                req,
                `Intento de acceso sin privilegio a ${req.path}. Intento numero ${numeroIntento}`
            );
            return res.send("No tienes permiso");
        }
        next();
    };
};

exports.requiereCuentaActiva = (req, res, next) => {
    //CU03-Paso 11:
    //Antes de entrar a un módulo operativo, el middleware comprueba si la sesión
    //del concesionario contiene una cuentaActiva definida.
    const usuario = req.session.usuario;

    if (!usuario || !Array.isArray(usuario.roles) || !usuario.roles.includes('Concesionario')) {
        return next();
    }

    if (!usuario.cuentaActiva || !usuario.cuentaActiva.id_cuenta) {
        //CU03-Flujo alternativo malo 5:
        //Si no existe cuenta activa en la sesión, se registra el intento
        //y se redirige al home para seleccionar una cuenta.
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

    //CU03-Paso 12:
    //Si sí existe cuenta activa en sesión, el middleware consulta al modelo
    //para verificar en BD que siga asociada al usuario y permanezca activa.
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
            //CU03-Flujo alternativo malo 3:
            //Si la cuenta ya no está asociada al usuario, se elimina de la sesión,
            //se registra el evento y se bloquea el acceso al módulo.
            req.session.usuario.cuentaActiva = null;
            registrarEvento(req, 'Cuenta activa no asociada al usuario');
            req.session.mensaje = {
                tipo: 'danger',
                texto: 'La cuenta activa ya no esta asociada a tu usuario.'
            };
            return res.redirect('/concesionario/home');
        }

        if (!cuenta.activo) {
            //CU03-Flujo alternativo malo 4:
            //Si la cuenta existe pero está inactiva, se limpia de la sesión,
            //se registra el intento y se obliga a elegir otra cuenta.
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

        //CU03-Paso 13:
        //En el camino exitoso, la cuenta válida se refresca en sesión
        //y el middleware prepara la continuación del flujo.
        req.session.usuario.cuentaActiva = cuenta;

        if (Array.isArray(req.session.usuario.cuentas)) {
            req.session.usuario.cuentas = req.session.usuario.cuentas.map(item =>
                item.id_cuenta === cuenta.id_cuenta ? cuenta : item
            );
        }

        //CU03-Paso 14:
        //Antes de llamar a next(), el acceso exitoso también se registra
        //en la bitácora de auditoría.
        registrarEvento(req, 'Acceso autorizado con cuenta activa válida');
        next();
    });
};
