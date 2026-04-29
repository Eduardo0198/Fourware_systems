const ERRORES = {
    403: { icono: 'bi-shield-lock', titulo: 'Acceso denegado' },
    404: { icono: 'bi-map',         titulo: 'Página no encontrada' },
};

module.exports = function renderError(res, status, descripcion, destino) {
    const { icono, titulo } = ERRORES[status] || { icono: 'bi-exclamation-triangle', titulo: 'Algo salió mal' };
    return res.status(status || 500).render('errors/error', {
        layout: false,
        codigo: String(status || 500),
        icono,
        titulo,
        descripcion: descripcion || 'Ocurrió un error inesperado en el servidor.',
        destino: destino || '/'
    });
};
