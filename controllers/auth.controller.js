const usuarioModel = require('../models/usuario.model');
const cuentaModel = require('../models/cuenta.model');
const bitacora = require('../models/bitacora.model');
const bcrypt = require('bcryptjs');

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
    const email = req.body.email;
    const password = req.body.password;
    usuarioModel.obtenerUsuarioConRoles(email, (err, rows) => {
        if (err || rows.length === 0) {
            return res.render('login', {
                layout: false,
                error: 'Usuario o contraseña incorrectos'
            });
        }
        usuarioModel.obtenerPassword(email, async (err2, result2) => {
            const hash = result2[0].contrasenia;
            const match = await bcrypt.compare(password, hash);
            if (!match) {
                return res.render('login', { 
                    layout: false,
                    error: 'Usuario o contraseña incorrectos'
                });
            }
            const roles = rows.map(r => r.nombre_rol);
            console.log("ROLES DEL USUARIO:", roles);

            usuarioModel.obtenerPrivilegios(email, (err3, privRows) => {
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
                    return redirigirSegunRol(roles, res);
                });
            });
        });
    });
};

exports.logout = (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
};
