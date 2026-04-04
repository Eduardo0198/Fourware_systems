module.exports = {
    ...require('./admin/general.controller'),
    ...require('./admin/auditoria.controller'),
    ...require('./admin/catalogo.controller'),
    ...require('./admin/campanas.controller'),
    ...require('./admin/reportes.controller')
};
