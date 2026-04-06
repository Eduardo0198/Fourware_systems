const { registrarEvento } = require('./shared');

exports.dashboard = (req, res) => {
    registrarEvento(req, 'Consulta de dashboard administrativo');
    res.render('dashboard');
};
