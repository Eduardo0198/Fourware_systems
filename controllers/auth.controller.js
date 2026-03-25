const usuarioModel = require('../models/usuario.model');
const bitacora = require('../models/bitacora.model');
const bcrypt = require('bcryptjs');

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
                req.session.usuario = {
                    correo: rows[0].correo,
                    nombre: rows[0].nombre,
                    roles: roles,
                    privilegios: privilegios
                };
                if (roles.includes('Administrador')) {
                    return res.redirect('/admin/dashboard');
                } else if (roles.includes('Logistica')) {
                    return res.redirect('/logistica/reservas-confirmadas');
                } else if (roles.includes('Marketing')) {
                    return res.redirect('/marketing/metricas-comparativas');
                } else {
                    return res.redirect('/concesionario/home');
                }
            });
        });
    });
};

exports.logout = (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
};