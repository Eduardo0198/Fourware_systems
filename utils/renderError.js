module.exports = function renderError(res, status, descripcion, destino) {
    return res.status(status || 500).render('errors/error', {
        layout: false,
        codigo: String(status || 500),
        icono: status === 404 ? 'bi-map' : 'bi-exclamation-triangle',
        titulo: status === 404 ? 'Página no encontrada' : 'Algo salió mal',
        descripcion: descripcion || 'Ocurrió un error inesperado en el servidor.',
        destino: destino || '/'
    });
};
