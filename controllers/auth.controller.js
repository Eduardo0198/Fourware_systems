const usuarioModel = require('../models/usuario.model');
const cuentaModel = require('../models/cuenta.model');
const bcrypt = require('bcryptjs');
const {
    registrarEvento,
    incrementarIntento,
    reiniciarIntento
} = require('../utils/auditoria.helper');

function redirigirSegunRol(roles, res) {
    if (roles.includes('Administrador')) {
        return res.redirect('/admin/dashboard');
    } else if (roles.includes('Logistica')) {
        return res.redirect('/logistica/reservas-confirmadas');
    } else if (roles.includes('Marketing')) {
        return res.redirect('/marketing/metricas-comparativas');
    }

    return res.redirect('/concesionario/home');
}

exports.login = (req, res) => {
    res.render('login', { 
        layout: false,
        error: null 
    });
};

exports.doLogin = (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!email || !password) {
        return res.render('login', {
            layout: false,
            error: 'Usuario o contraseña incorrectos'
        });
    }

    usuarioModel.obtenerUsuarioConRoles(email, (err, rows) => {
        if (err || rows.length === 0) {
            // inicio caso 8 lau
            const numeroIntento = incrementarIntento(req, 'login_fallido');
            registrarEvento(
                req,
                `Intento fallido de inicio de sesión numero ${numeroIntento}`,
                email
            );
            // fin caso 8 lau
            return res.render('login', {
                layout: false,
                error: 'Usuario o contraseña incorrectos'
            });
        }
        usuarioModel.obtenerPassword(email, async (err2, result2) => {
            if (err2 || !Array.isArray(result2) || result2.length === 0 || !result2[0].contrasenia) {
                return res.render('login', {
                    layout: false,
                    error: 'Usuario o contraseña incorrectos'
                });
            }

            const hash = result2[0].contrasenia;
            const match = await bcrypt.compare(password, hash);
            if (!match) {
                // inicio caso 8 lau
                const numeroIntento = incrementarIntento(req, 'login_fallido');
                registrarEvento(
                    req,
                    `Intento fallido de inicio de sesión numero ${numeroIntento}`,
                    email
                );
                // fin caso 8 lau
                return res.render('login', { 
                    layout: false,
                    error: 'Usuario o contraseña incorrectos'
                });
            }
            const roles = rows.map(r => r.nombre_rol);

            usuarioModel.obtenerPrivilegios(email, (err3, privRows) => {
                if (err3 || !Array.isArray(privRows)) {
                    return res.render('login', {
                        layout: false,
                        error: 'No fue posible iniciar sesión. Intente nuevamente.'
                    });
                }

                const privilegios = privRows.map(p => p.nombre_privilegio);
                const usuarioSesion = {
                    correo: rows[0].correo,
                    nombre: rows[0].nombre,
                    roles: roles,
                    privilegios: privilegios,
                    cuentas: [],
                    cuentaActiva: null
                };

                if (!roles.includes('Concesionario')) {
                    req.session.usuario = usuarioSesion;
                    // inicio caso 8 lau
                    reiniciarIntento(req, 'login_fallido');
                    registrarEvento(req, 'Inicio de sesión exitoso', usuarioSesion.correo);
                    // fin caso 8 lau
                    return redirigirSegunRol(roles, res);
                }

                cuentaModel.obtenerCuentasPorCorreo(rows[0].correo, (err4, cuentas) => {
                    if (err4) {
                        console.error(err4);
                        req.session.usuario = usuarioSesion;
                        return redirigirSegunRol(roles, res);
                    }

                    usuarioSesion.cuentas = cuentas;
                    usuarioSesion.cuentaActiva = cuentaModel.obtenerCuentaActivaPorDefecto(cuentas);
                    req.session.usuario = usuarioSesion;
                    req.session.carritoCuentaId = usuarioSesion.cuentaActiva?.id_cuenta || null;
                    // inicio caso 8 lau
                    reiniciarIntento(req, 'login_fallido');
                    registrarEvento(req, 'Inicio de sesión exitoso', usuarioSesion.correo);
                    // fin caso 8 lau
                    return redirigirSegunRol(roles, res);
                });
            });
        });
    });
};

exports.logout = (req, res) => {
    // inicio caso 8 lau
    registrarEvento(req, 'Cierre de sesión');
    // fin caso 8 lau
    req.session.destroy(() => {
        res.redirect('/');
    });
};
