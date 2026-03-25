exports.protegerRuta = (req, res, next) => {
    if (!req.session.usuario) {
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
