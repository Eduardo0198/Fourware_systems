const {
    campaniaModel,
    cancelacionModel,
    esFechaValida,
    normalizarCampania,
    registrarBitacora,
    registrarEvento
} = require('./shared');

function renderCampaniaCrear(res, options = {}) {
    campaniaModel.obtenerTodas((err, campanias) => {
        if (err) {
            console.error(err);
            return res.status(500).send('No fue posible cargar las campanas.');
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
            console.error(err);
            return res.status(500).send('No fue posible cargar las campanas.');
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

function actualizarCampaniaValidada(req, res, idCampania, campaniaActual, validacion) {
    campaniaModel.existeConflictoPeriodo(
        validacion.formData.fecha_inicio,
        validacion.formData.fecha_fin,
        idCampania,
        (errConflicto, existeConflicto) => {
            if (errConflicto) {
                console.error(errConflicto);
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
                        console.error(err);
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
            console.error(err);
            return res.status(500).send('No fue posible cargar las campanas.');
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
                console.error(errConflicto);
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
                    console.error(err);
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
    const idCampania = parseInt(req.params.id, 10);
    const validacion = validarCampania(req.body);

    if (Number.isNaN(idCampania)) {
        req.session.mensaje = {
            tipo: 'danger',
            texto: 'La campana seleccionada no es valida.'
        };
        return res.redirect('/admin/campanas/editar');
    }

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

    campaniaModel.obtenerPorId(idCampania, (errCampania, campaniaActual) => {
        if (errCampania || !campaniaActual) {
            console.error(errCampania);
            req.session.mensaje = {
                tipo: 'danger',
                texto: 'La campana seleccionada no existe.'
            };
            return res.redirect('/admin/campanas/editar');
        }

        actualizarCampaniaValidada(req, res, idCampania, campaniaActual, validacion);
    });
};

exports.cancelacionCampana = (req, res) => {
    cancelacionModel.obtener((err, configuracion) => {
        if (err) {
            console.error(err);
            return res.status(500).send('No fue posible cargar la configuracion de cancelacion.');
        }

        registrarEvento(req, 'Consulta de configuracion de cancelacion de reservas');
        res.render('modules/campanaCancelacion', {
            pageMessage: res.locals.mensaje || null,
            horasCancelacion: configuracion.horas_cancelacion
        });
    });
};

exports.cancelacionCampanaPost = (req, res) => {
    const horas = parseInt(req.body.horas_cancelacion, 10);

    if (Number.isNaN(horas) || horas <= 0) {
        return res.render('modules/campanaCancelacion', {
            pageMessage: {
                tipo: 'danger',
                texto: 'Debes capturar una cantidad valida de horas para cancelar reservas.'
            },
            horasCancelacion: req.body.horas_cancelacion
        });
    }

    cancelacionModel.actualizar(horas, (err, configuracion) => {
        if (err) {
            console.error(err);
            registrarBitacora(req, 'Error al configurar la ventana de cancelacion de reservas');
            return res.render('modules/campanaCancelacion', {
                pageMessage: {
                    tipo: 'danger',
                    texto: 'No fue posible guardar la ventana de cancelacion. Intente nuevamente.'
                },
                horasCancelacion: req.body.horas_cancelacion
            });
        }

        registrarBitacora(
            req,
            `Configuracion de ventana de cancelacion a ${configuracion.horas_cancelacion} horas`
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
            console.error(errCampania);
            req.session.mensaje = {
                tipo: 'danger',
                texto: 'La campana seleccionada no existe.'
            };
            return res.redirect('/admin/campanas/editar');
        }

        campaniaModel.existeOtraCampaniaActiva(idCampania, (errActiva, existeOtraActiva) => {
            if (errActiva) {
                console.error(errActiva);
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
                        console.error(errActualizar);
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
            console.error(errCampania);
            req.session.mensaje = {
                tipo: 'danger',
                texto: 'La campana seleccionada no existe.'
            };
            return res.redirect('/admin/campanas/editar');
        }

        campaniaModel.desactivar(idCampania, (errDesactivar) => {
            if (errDesactivar) {
                console.error(errDesactivar);
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
