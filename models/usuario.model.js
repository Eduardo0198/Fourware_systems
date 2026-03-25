const db = require('../config/db');

exports.obtenerUsuarioConRoles = (correo, callback) => {
    const query = `
        SELECT u.correo, u.nombre, r.nombre_rol
        FROM Usuario u
        JOIN Usuario_Rol ur ON u.correo = ur.correo
        JOIN Rol r ON ur.id_rol = r.id_rol
        WHERE u.correo = ?
    `;
    db.query(query, [correo], callback);
};

exports.obtenerPassword = (correo, callback) => {
    const query = `SELECT contrasenia FROM Usuario WHERE correo = ?`;
    db.query(query, [correo], callback);
};

exports.obtenerPrivilegios = (correo, callback) => {
    const query = `
        SELECT p.nombre_privilegio
        FROM Usuario u
        JOIN Usuario_Rol ur ON u.correo = ur.correo
        JOIN Rol_Privilegio rp ON ur.id_rol = rp.id_rol
        JOIN Privilegio p ON rp.id_privilegio = p.id_privilegio
        WHERE u.correo = ?
    `;
    db.query(query, [correo], callback);
};