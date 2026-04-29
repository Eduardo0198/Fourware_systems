const concesionarioModel = require('../../models/concesionario.model');
const campaniaModel = require('../../models/campania.model');
const calificacionModel = require('../../models/calificacion.model');
const logger = require('../../utils/logger');
const { registrarEvento } = require('../../utils/auditoria.helper');
const { obtenerDatosCatalogo } = require('./shared');
const renderError = require('../../utils/renderError');

exports.catalogo = (req, res) => {
    obtenerDatosCatalogo(req, concesionarioModel, (err, data) => {
        if (err) {
            logger.error(err);
            registrarEvento(req, 'Error al consultar catálogo de productos');
            return renderError(res, 500, 'Error al obtener el catálogo.', '/concesionario/home');
        }

        if (!data.campaniaActiva) {
            registrarEvento(req, 'Intento de consulta de catálogo sin campaña vigente');
            return res.render('modules/concesionarioCatalogo', {
                ...data,
                mostrarBanner: true,
                pageMessage: {
                    tipo: 'warning',
                    texto: 'No existe una campaña de preventa vigente.'
                }
            });
        }

        registrarEvento(
            req,
            data.query
                ? 'Búsqueda de productos mediante buscador predictivo'
                : 'Consulta de catálogo de productos'
        );

        return res.render('modules/concesionarioCatalogo', {
            ...data,
            mostrarBanner: true,
            pageMessage: null
        });
    });
};

exports.catalogoPredictivo = (req, res) => {
    req.query.page = '1';
    req.query.limit = '12';

    obtenerDatosCatalogo(req, concesionarioModel, (err, data) => {
        if (err) {
            logger.error(err);
            registrarEvento(req, 'Error en búsqueda predictiva de catálogo');
            return res.status(500).json({
                ok: false,
                mensaje: 'No fue posible realizar la búsqueda.'
            });
        }

        if (!data.campaniaActiva) {
            registrarEvento(req, 'Intento de búsqueda predictiva sin campaña vigente');
            return res.status(409).json({
                ok: false,
                mensaje: 'No existe una campaña de preventa vigente.',
                productos: [],
                paginacion: {
                    paginaActual: 1,
                    totalPaginas: 0
                }
            });
        }

        registrarEvento(
            req,
            data.query
                ? 'Búsqueda predictiva de productos en catálogo'
                : 'Consulta predictiva de catálogo de productos'
        );

        return res.json({
            ok: true,
            productos: data.productos,
            paginacion: data.paginacion,
            query: data.query,
            precio_min: data.precio_min,
            precio_max: data.precio_max,
            unidad_venta_seleccionada: data.unidad_venta_seleccionada,
            hayBusquedaOFiltros: data.hayBusquedaOFiltros
        });
    });
};

exports.producto = (req, res) => {
    const sku = req.params.sku;
    const returnToRaw = String(req.query.return_to || '/concesionario/catalogo').trim();
    const returnTo = returnToRaw.startsWith('/concesionario/catalogo')
        ? returnToRaw
        : `/concesionario/catalogo${returnToRaw.startsWith('?') ? returnToRaw : ''}`;

    campaniaModel.obtenerCampaniaActiva((campaniaErr, campanias) => {
        if (campaniaErr) {
            logger.error(campaniaErr);
            registrarEvento(req, 'Error al validar campaña vigente para detalle de producto');
            req.session.mensaje = {
                tipo: 'danger',
                texto: 'Error en la consulta.'
            };
            return res.redirect('/concesionario/catalogo');
        }

        const campaniaActiva = Array.isArray(campanias) && campanias.length > 0
            ? campanias[0]
            : null;

        if (!campaniaActiva) {
            registrarEvento(req, 'Intento de consulta de detalle sin campaña vigente');
            req.session.mensaje = {
                tipo: 'warning',
                texto: 'La campaña de preventa no se encuentra disponible en este momento.'
            };
            return res.redirect('/concesionario/catalogo');
        }

        concesionarioModel.obtenerProductoActivoPorSkuYCampania(
            sku,
            campaniaActiva.id_campania,
            (err, producto) => {
                if (err) {
                    logger.error(err);
                    registrarEvento(req, 'Error al consultar detalle técnico y logístico de producto');
                    req.session.mensaje = {
                        tipo: 'danger',
                        texto: 'Error en la consulta.'
                    };
                    return res.redirect('/concesionario/catalogo');
                }

                if (!producto) {
                    registrarEvento(req, 'Intento de consulta de producto no disponible');
                    req.session.mensaje = {
                        tipo: 'warning',
                        texto: 'El producto seleccionado ya no se encuentra disponible.'
                    };
                    return res.redirect('/concesionario/catalogo');
                }

                calificacionModel.obtenerResumenCalificacionesPorSku(sku, (errResumen, resumenCalificaciones) => {
                    if (errResumen) {
                        logger.error(errResumen);
                        registrarEvento(req, 'Error al consultar resumen de reseñas del producto');
                        req.session.mensaje = {
                            tipo: 'danger',
                            texto: 'Error en la consulta.'
                        };
                        return res.redirect('/concesionario/catalogo');
                    }

                    calificacionModel.obtenerResenasPorSku(sku, (errResenas, resenas) => {
                        if (errResenas) {
                            logger.error(errResenas);
                            registrarEvento(req, 'Error al consultar reseñas del producto');
                            req.session.mensaje = {
                                tipo: 'danger',
                                texto: 'Error en la consulta.'
                            };
                            return res.redirect('/concesionario/catalogo');
                        }

                        const totalResenas = resumenCalificaciones.total_resenas || 0;
                        const distribucionConPorcentaje = [5, 4, 3, 2, 1].map((estrella) => {
                            const total = resumenCalificaciones.distribucion[estrella] || 0;
                            return {
                                estrella,
                                total,
                                porcentaje: totalResenas > 0
                                    ? Math.round((total / totalResenas) * 100)
                                    : 0
                            };
                        });

                        registrarEvento(req, 'Consulta de detalle técnico y logístico de producto');
                        return res.render('modules/concesionarioProducto', {
                            producto,
                            returnTo,
                            resumenCalificaciones,
                            distribucionConPorcentaje,
                            resenas: Array.isArray(resenas) ? resenas : []
                        });
                    });
                });
            }
        );
    });
};

exports.confirmarReserva = (req, res) => {
    registrarEvento(req, 'Consulta de confirmación de reserva');
    return res.render('modules/concesionarioConfirmarReserva');
};

exports.calificarProducto = (req, res) => {
    const sku = req.params.sku || req.body.sku;
    const { calificacion, comentario } = req.body;
    const correo = req.session.usuario?.correo;
    const esAjax = req.headers['x-requested-with'] === 'XMLHttpRequest';

    const respError = (texto, status = 400) => {
        if (esAjax) return res.status(status).json({ ok: false, mensaje: texto });
        req.session.mensaje = { tipo: 'danger', texto };
        return res.redirect(sku ? `/concesionario/producto/${sku}` : '/concesionario/catalogo');
    };

    if (!sku) return respError('No fue posible identificar el producto a calificar.');
    if (!calificacion || calificacion < 1 || calificacion > 5) return respError('Calificación inválida. Debe ser entre 1 y 5.');

    calificacionModel.registrarCalificacion(correo, sku, calificacion, comentario || '', (err) => {
        if (err) {
            logger.error(err);
            registrarEvento(req, 'Error al registrar calificación de producto');
            return respError('Error al registrar la calificación.', 500);
        }

        registrarEvento(req, 'Registro de calificación y comentario sobre producto de preventa');

        if (esAjax) return res.json({ ok: true, mensaje: 'Calificación registrada exitosamente.' });

        req.session.mensaje = { tipo: 'success', texto: 'Calificación registrada exitosamente.' };
        return res.redirect(`/concesionario/producto/${sku}`);
    });
};
