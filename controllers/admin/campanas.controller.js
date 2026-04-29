const path = require('path');
const fs = require('fs');
const {
    campaniaModel,
    cancelacionModel,
    esFechaValida,
    normalizarCampania,
    registrarBitacora,
    registrarEvento
} = require('./shared');
const logger = require('../../utils/logger');
const renderError = require('../../utils/renderError');

const BANNERS_DIR = path.join('public', 'img', 'banners');
if (!fs.existsSync(BANNERS_DIR)) fs.mkdirSync(BANNERS_DIR, { recursive: true });

function renderCampaniaCrear(res, options = {}) {
    campaniaModel.obtenerTodas((err, campanias) => {
        if (err) {
            logger.error(err);
            return renderError(res, 500, 'No fue posible cargar las campañas.', '/admin/inicio');
        }

        res.render('modules/campanaCrear', {
            pageMessage: options.pageMessage || res.locals.mensaje || null,
            formData: options.formData || {},
            campanias: campanias.map(normalizarCampania)
        });
    });
}

function renderCampaniaEditar(req, res, options = {}) {
    campaniaModel.obtenerTodas((err, campanias) => {
        if (err) {
            logger.error(err);
            return renderError(res, 500, 'No fue posible cargar las campañas.', '/admin/inicio');
        }

        const idSeleccionado = parseInt(options.idSeleccionado || req.query.id, 10);
        const campaniasNormalizadas = campanias.map(normalizarCampania);
        const campaniaSeleccionada = campaniasNormalizadas.find(
            (item) => item.id_campania === idSeleccionado
        ) || campaniasNormalizadas[0] || null;

        res.render('modules/campanaEditar', {
            pageMessage: options.pageMessage || res.locals.mensaje || null,
            campanias: campaniasNormalizadas,
            campaniaSeleccionada,
            formData: options.formData || campaniaSeleccionada || null
        });
    });
}

function validarCampania(input) {
    const formData = {
        nombre: String(input.nombre || '').trim(),
        fecha_inicio: String(input.fecha_inicio || '').trim(),
        fecha_fin: String(input.fecha_fin || '').trim(),
        banner: String(input.banner || '').trim()
    };

    if (Object.values(formData).some((valor) => !valor)) {
        return {
            valido: false,
            mensaje: 'Debes completar nombre, fechas y banner de la campana.',
            formData
        };
    }

    if (!esFechaValida(formData.fecha_inicio) || !esFechaValida(formData.fecha_fin)) {
        return {
            valido: false,
            mensaje: 'Debes capturar fechas validas para la campana.',
            formData
        };
    }

    if (new Date(formData.fecha_inicio) >= new Date(formData.fecha_fin)) {
        return {
            valido: false,
            mensaje: 'La fecha de inicio debe ser anterior a la fecha de fin.',
            formData
        };
    }

    return {
        valido: true,
        formData
    };
}

function resolverBannerEdicion(req, campaniaActual) {
    // aqui leo la opcion que eligio el usuario en el formulario
    const modoBanner = String(req.body.modoBanner || '').trim();

    // si el usuario eligio mantener el banner actual, regreso el banner guardado de la campania
    if (modoBanner === 'mantener') {
        return campaniaActual.banner || '';
    }

    // si el usuario eligio subir archivo, regreso el valor que ya se guardo en req.body.banner
    // ese valor se asigna antes cuando se procesa req.file
    if (modoBanner === 'archivo') {
        return String(req.body.banner || '').trim();
    }

    // si el usuario eligio URL, regreso el texto que escribio en el input de banner
    if (modoBanner === 'url') {
        return String(req.body.banner || '').trim();
    }

    // si por alguna razon no viene el modo, regreso el banner como venga en el body
    return String(req.body.banner || '').trim();
}

function actualizarCampaniaValidada(req, res, idCampania, campaniaActual, validacion) {
    campaniaModel.existeConflictoPeriodo(
        validacion.formData.fecha_inicio,
        validacion.formData.fecha_fin,
        idCampania,
        (errConflicto, existeConflicto) => {
            if (errConflicto) {
                logger.error(errConflicto);
                return renderCampaniaEditar(req, res, {
                    idSeleccionado: idCampania,
                    pageMessage: {
                        tipo: 'danger',
                        texto: 'No fue posible validar el periodo de la campana.'
                    },
                    formData: {
                        id_campania: idCampania,
                        ...validacion.formData
                    }
                });
            }

            if (existeConflicto) {
                return renderCampaniaEditar(req, res, {
                    idSeleccionado: idCampania,
                    pageMessage: {
                        tipo: 'danger',
                        texto: 'Existe otra campana activa en el mismo periodo.'
                    },
                    formData: {
                        id_campania: idCampania,
                        ...validacion.formData
                    }
                });
            }

            campaniaModel.actualizar(
                idCampania,
                {
                    ...validacion.formData,
                    estatus: Number(campaniaActual.estatus) === 1 ? 1 : 0
                },
                (err, result) => {
                    if (err || !result.affectedRows) {
                        logger.error(err);
                        registrarBitacora(req, `Error al editar la campana ${idCampania}`);
                        return renderCampaniaEditar(req, res, {
                            idSeleccionado: idCampania,
                            pageMessage: {
                                tipo: 'danger',
                                texto: 'No fue posible actualizar la campana. Intente nuevamente.'
                            },
                            formData: {
                                id_campania: idCampania,
                                ...validacion.formData
                            }
                        });
                    }

                    registrarBitacora(req, `Edicion de campana ${idCampania}`);

                    req.session.mensaje = {
                        tipo: 'success',
                        texto: 'Campana configurada correctamente.'
                    };

                    res.redirect(`/admin/campanas/editar?id=${idCampania}`);
                }
            );
        }
    );
}

exports.campanas = (req, res) => {
    campaniaModel.obtenerTodas((err, campanias) => {
        if (err) {
            logger.error(err);
            return renderError(res, 500, 'No fue posible cargar las campañas.', '/admin/inicio');
        }

        const campaniasNormalizadas = campanias.map(normalizarCampania);
        registrarEvento(req, 'Consulta de configuracion de campanas');
        res.render('modules/adminCampanas', {
            campanias: campaniasNormalizadas,
            totalCampanias: campaniasNormalizadas.length,
            totalActivas: campaniasNormalizadas.filter((item) => item.estatus === 1).length
        });
    });
};

exports.crearCampana = (req, res) => {
    registrarEvento(req, 'Consulta de creacion de campana');
    renderCampaniaCrear(res);
};

exports.crearCampanaPost = (req, res) => {
    if (req.file) {
        const ext = path.extname(req.file.originalname).toLowerCase();
        const filename = `banner_${Date.now()}${ext}`;
        fs.writeFileSync(path.join(BANNERS_DIR, filename), req.file.buffer);
        req.body.banner = `/img/banners/${filename}`;
    }

    const validacion = validarCampania(req.body);

    if (!validacion.valido) {
        return renderCampaniaCrear(res, {
            pageMessage: {
                tipo: 'danger',
                texto: validacion.mensaje
            },
            formData: validacion.formData
        });
    }

    campaniaModel.existeConflictoPeriodo(
        validacion.formData.fecha_inicio,
        validacion.formData.fecha_fin,
        null,
        (errConflicto, existeConflicto) => {
            if (errConflicto) {
                logger.error(errConflicto);
                return renderCampaniaCrear(res, {
                    pageMessage: {
                        tipo: 'danger',
                        texto: 'No fue posible validar el periodo de la campana.'
                    },
                    formData: validacion.formData
                });
            }

            if (existeConflicto) {
                return renderCampaniaCrear(res, {
                    pageMessage: {
                        tipo: 'danger',
                        texto: 'Existe otra campana activa en el mismo periodo.'
                    },
                    formData: validacion.formData
                });
            }

            campaniaModel.crear({
                ...validacion.formData,
                estatus: 0
            }, (err) => {
                if (err) {
                    logger.error(err);
                    registrarBitacora(
                        req,
                        `Error al configurar la campana ${validacion.formData.nombre}`
                    );
                    return renderCampaniaCrear(res, {
                        pageMessage: {
                            tipo: 'danger',
                            texto: 'No fue posible configurar la campana. Intente nuevamente.'
                        },
                        formData: validacion.formData
                    });
                }

                registrarBitacora(req, `Registro de campana ${validacion.formData.nombre}`);

                req.session.mensaje = {
                    tipo: 'success',
                    texto: 'Campana configurada correctamente.'
                };

                res.redirect('/admin/campanas/crear');
            });
        }
    );
};

exports.editarCampana = (req, res) => {
    registrarEvento(req, 'Consulta de edicion de campana');
    renderCampaniaEditar(req, res);
};

exports.editarCampanaPost = (req, res) => {
    if (req.file) {
        const ext = path.extname(req.file.originalname).toLowerCase();
        const filename = `banner_${Date.now()}${ext}`;
        fs.writeFileSync(path.join(BANNERS_DIR, filename), req.file.buffer);
        req.body.banner = `/img/banners/${filename}`;
    }

    const idCampania = parseInt(req.params.id, 10);

    if (Number.isNaN(idCampania)) {
        req.session.mensaje = {
            tipo: 'danger',
            texto: 'La campana seleccionada no es valida.'
        };
        return res.redirect('/admin/campanas/editar');
    }

    campaniaModel.obtenerPorId(idCampania, (errCampania, campaniaActual) => {
        if (errCampania || !campaniaActual) {
            logger.error(errCampania);
            req.session.mensaje = {
                tipo: 'danger',
                texto: 'La campana seleccionada no existe.'
            };
            return res.redirect('/admin/campanas/editar');
        }

        // aqui resuelvo cual banner final debe usar la edicion:
        // mantener el actual, usar el archivo nuevo o usar la URL escrita
        req.body.banner = resolverBannerEdicion(req, campaniaActual);

        // aqui ya valido el formulario con el banner final resuelto
        const validacion = validarCampania(req.body);

        if (!validacion.valido) {
            return renderCampaniaEditar(req, res, {
                idSeleccionado: idCampania,
                pageMessage: {
                    tipo: 'danger',
                    texto: validacion.mensaje
                },
                formData: {
                    id_campania: idCampania,
                    ...validacion.formData
                }
            });
        }

        actualizarCampaniaValidada(req, res, idCampania, campaniaActual, validacion);
    });
};

exports.cancelacionCampana = (req, res) => {
    cancelacionModel.obtener((err, configuracion) => {
        if (err) {
            logger.error(err);
            return renderError(res, 500, 'No fue posible cargar la configuración de cancelación.', '/admin/inicio');
        }

        registrarEvento(req, 'Consulta de configuracion de cancelacion de reservas');
        res.render('modules/campanaCancelacion', {
            pageMessage: res.locals.mensaje || null,
            minutosCancelacion: configuracion.minutos_cancelacion
        });
    });
};

exports.cancelacionCampanaPost = (req, res) => {
    const minutos = parseInt(req.body.minutos_cancelacion, 10);

    if (Number.isNaN(minutos) || minutos <= 0) {
        return res.render('modules/campanaCancelacion', {
            pageMessage: {
                tipo: 'danger',
                texto: 'Debes capturar una cantidad válida de minutos para cancelar reservas.'
            },
            minutosCancelacion: req.body.minutos_cancelacion
        });
    }

    cancelacionModel.actualizar(minutos, (err, configuracion) => {
        if (err) {
            logger.error(err);
            registrarBitacora(req, 'Error al configurar la ventana de cancelacion de reservas');
            return res.render('modules/campanaCancelacion', {
                pageMessage: {
                    tipo: 'danger',
                    texto: 'No fue posible guardar la ventana de cancelacion. Intente nuevamente.'
                },
                minutosCancelacion: req.body.minutos_cancelacion
            });
        }

        registrarBitacora(
            req,
            `Configuracion de ventana de cancelacion a ${configuracion.minutos_cancelacion} minutos`
        );

        req.session.mensaje = {
            tipo: 'success',
            texto: 'Ventana de cancelacion configurada correctamente.'
        };

        res.redirect('/admin/campanas/cancelacion');
    });
};

exports.estadoCampana = (req, res) => {
    registrarEvento(req, 'Consulta de estado de campana');
    res.redirect('/admin/campanas/editar');
};

exports.activarCampana = (req, res) => {
    const idCampania = parseInt(req.params.id, 10);

    if (Number.isNaN(idCampania)) {
        req.session.mensaje = {
            tipo: 'danger',
            texto: 'La campana seleccionada no es valida.'
        };
        return res.redirect('/admin/campanas/editar');
    }

    campaniaModel.obtenerPorId(idCampania, (errCampania, campania) => {
        if (errCampania || !campania) {
            logger.error(errCampania);
            req.session.mensaje = {
                tipo: 'danger',
                texto: 'La campana seleccionada no existe.'
            };
            return res.redirect('/admin/campanas/editar');
        }

        campaniaModel.existeOtraCampaniaActiva(idCampania, (errActiva, existeOtraActiva) => {
            if (errActiva) {
                logger.error(errActiva);
                req.session.mensaje = {
                    tipo: 'danger',
                    texto: 'No fue posible validar el estatus de las campanas.'
                };
                return res.redirect(`/admin/campanas/editar?id=${idCampania}`);
            }

            if (existeOtraActiva) {
                req.session.mensaje = {
                    tipo: 'danger',
                    texto: 'No puedes activar dos campanas a la vez. Si quieres activar otra, primero desactiva la que ya esta activa.'
                };
                return res.redirect(`/admin/campanas/editar?id=${idCampania}`);
            }

            campaniaModel.actualizar(
                idCampania,
                {
                    nombre: campania.nombre,
                    fecha_inicio: new Date(campania.fecha_inicio).toISOString().slice(0, 10),
                    fecha_fin: new Date(campania.fecha_fin).toISOString().slice(0, 10),
                    banner: campania.banner,
                    estatus: 1
                },
                (errActualizar) => {
                    if (errActualizar) {
                        logger.error(errActualizar);
                        req.session.mensaje = {
                            tipo: 'danger',
                            texto: 'No fue posible activar la campana. Intente nuevamente.'
                        };
                        return res.redirect(`/admin/campanas/editar?id=${idCampania}`);
                    }

                    registrarBitacora(req, `Activacion de campana ${campania.nombre}`);

                    req.session.mensaje = {
                        tipo: 'success',
                        texto: 'Campana activada correctamente.'
                    };

                    res.redirect(`/admin/campanas/editar?id=${idCampania}`);
                }
            );
        });
    });
};

exports.desactivarCampana = (req, res) => {
    const idCampania = parseInt(req.params.id, 10);

    if (Number.isNaN(idCampania)) {
        req.session.mensaje = {
            tipo: 'danger',
            texto: 'La campana seleccionada no es valida.'
        };
        return res.redirect('/admin/campanas/editar');
    }

    campaniaModel.obtenerPorId(idCampania, (errCampania, campania) => {
        if (errCampania || !campania) {
            logger.error(errCampania);
            req.session.mensaje = {
                tipo: 'danger',
                texto: 'La campana seleccionada no existe.'
            };
            return res.redirect('/admin/campanas/editar');
        }

        campaniaModel.desactivar(idCampania, (errDesactivar) => {
            if (errDesactivar) {
                logger.error(errDesactivar);
                registrarBitacora(req, `Error al desactivar la campana ${idCampania}`);
                req.session.mensaje = {
                    tipo: 'danger',
                    texto: 'No fue posible desactivar la campana. Intente nuevamente.'
                };
                return res.redirect(`/admin/campanas/editar?id=${idCampania}`);
            }

            registrarBitacora(req, `Desactivacion de campana ${campania.nombre}`);

            req.session.mensaje = {
                tipo: 'success',
                texto: 'Campana desactivada correctamente.'
            };

            res.redirect(`/admin/campanas/editar?id=${idCampania}`);
        });
    });
};
