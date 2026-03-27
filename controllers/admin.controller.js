const bitacoraModel = require('../models/bitacora.model');
const campaniaModel = require('../models/campania.model');
const productoModel = require('../models/producto.model');

function aNumeroDecimal(valor) {
    const numero = parseFloat(valor);
    return Number.isFinite(numero) ? numero : NaN;
}

function esFechaValida(valor) {
    return Boolean(valor) && !Number.isNaN(new Date(valor).getTime());
}

function normalizarCampania(campania) {
    if (!campania) {
        return null;
    }

    const inicio = new Date(campania.fecha_inicio);
    const fin = new Date(campania.fecha_fin);

    return {
        ...campania,
        estatus: Number(campania.estatus) === 1 ? 1 : 0,
        estatusTexto: Number(campania.estatus) === 1 ? 'Activa' : 'Inactiva',
        fecha_inicio_input: inicio.toISOString().slice(0, 10),
        fecha_fin_input: fin.toISOString().slice(0, 10),
        fecha_inicio_texto: inicio.toLocaleDateString('es-MX'),
        fecha_fin_texto: fin.toLocaleDateString('es-MX')
    };
}

function normalizarProducto(producto) {
    return {
        ...producto,
        activo: Number(producto.activo) === 1 ? 1 : 0,
        estatusTexto: Number(producto.activo) === 1 ? 'Activo' : 'Inactivo'
    };
}

function renderCatalogoRegistro(res, options = {}) {
    campaniaModel.obtenerSeleccionablesParaCatalogo((errCampanias, campanias) => {
        if (errCampanias) {
            console.error(errCampanias);
            return res.status(500).send('No fue posible cargar las campañas.');
        }

        productoModel.listarProductosCatalogo((errProductos, productos) => {
            if (errProductos) {
                console.error(errProductos);
                return res.status(500).send('No fue posible cargar los productos.');
            }

            res.render('modules/catalogoRegistrar', {
                pageMessage: options.pageMessage || null,
                formData: options.formData || {},
                campanias: campanias.map(normalizarCampania),
                productos: productos.map(normalizarProducto)
            });
        });
    });
}

function renderCampaniaCrear(res, options = {}) {
    campaniaModel.obtenerTodas((err, campanias) => {
        if (err) {
            console.error(err);
            return res.status(500).send('No fue posible cargar las campañas.');
        }

        res.render('modules/campanaCrear', {
            pageMessage: options.pageMessage || null,
            formData: options.formData || {},
            campanias: campanias.map(normalizarCampania)
        });
    });
}

function renderCampaniaEditar(req, res, options = {}) {
    campaniaModel.obtenerTodas((err, campanias) => {
        if (err) {
            console.error(err);
            return res.status(500).send('No fue posible cargar las campañas.');
        }

        const idSeleccionado = parseInt(
            options.idSeleccionado || req.query.id,
            10
        );

        const campaniasNormalizadas = campanias.map(normalizarCampania);
        const campaniaSeleccionada = campaniasNormalizadas.find(
            (item) => item.id_campania === idSeleccionado
        ) || campaniasNormalizadas[0] || null;

        res.render('modules/campanaEditar', {
            pageMessage: options.pageMessage || null,
            campanias: campaniasNormalizadas,
            campaniaSeleccionada: campaniaSeleccionada,
            formData: options.formData || campaniaSeleccionada || null
        });
    });
}

function validarProducto(input) {
    const formData = {
        sku: String(input.sku || '').trim().toUpperCase(),
        nombre_comercial: String(input.nombre_comercial || '').trim(),
        descripcion: String(input.descripcion || '').trim(),
        unidad_venta: String(input.unidad_venta || '').trim(),
        medida_primaria: String(input.medida_primaria || '').trim(),
        precio_unitario: String(input.precio_unitario || '').trim(),
        peso_unitario: String(input.peso_unitario || '').trim(),
        volumen_unitario: String(input.volumen_unitario || '').trim(),
        imagen: String(input.imagen || '').trim(),
        id_campania: String(input.id_campania || '').trim()
    };

    if (Object.values(formData).some(valor => !valor)) {
        return {
            valido: false,
            mensaje: 'Debes capturar todos los campos del producto.',
            formData
        };
    }

    const precio = aNumeroDecimal(formData.precio_unitario);
    const peso = aNumeroDecimal(formData.peso_unitario);
    const volumen = aNumeroDecimal(formData.volumen_unitario);
    const idCampania = parseInt(formData.id_campania, 10);

    if ([precio, peso, volumen].some(valor => Number.isNaN(valor) || valor <= 0)) {
        return {
            valido: false,
            mensaje: 'Precio, peso y volumen deben ser números mayores a cero.',
            formData
        };
    }

    if (Number.isNaN(idCampania)) {
        return {
            valido: false,
            mensaje: 'Debes seleccionar una campaña válida.',
            formData
        };
    }

    return {
        valido: true,
        formData,
        producto: {
            sku: formData.sku,
            nombre_comercial: formData.nombre_comercial,
            descripcion: formData.descripcion,
            unidad_venta: formData.unidad_venta,
            medida_primaria: formData.medida_primaria,
            precio_unitario: precio,
            peso_unitario: peso,
            volumen_unitario: volumen,
            imagen: formData.imagen,
            id_campania: idCampania,
            activo: 0
        }
    };
}

function validarCampania(input) {
    const formData = {
        nombre: String(input.nombre || '').trim(),
        fecha_inicio: String(input.fecha_inicio || '').trim(),
        fecha_fin: String(input.fecha_fin || '').trim(),
        banner: String(input.banner || '').trim()
    };

    if (Object.values(formData).some(valor => !valor)) {
        return {
            valido: false,
            mensaje: 'Debes completar nombre, fechas y banner de la campaña.',
            formData
        };
    }

    if (!esFechaValida(formData.fecha_inicio) || !esFechaValida(formData.fecha_fin)) {
        return {
            valido: false,
            mensaje: 'Debes capturar fechas válidas para la campaña.',
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

exports.dashboard = (req, res) => {
    res.render('dashboard');
};

exports.catalogo = (req, res) => {
    productoModel.listarProductosCatalogo((errProductos, productos) => {
        if (errProductos) {
            console.error(errProductos);
            return res.status(500).send('No fue posible cargar el catálogo.');
        }

        campaniaModel.obtenerSeleccionablesParaCatalogo((errCampanias, campanias) => {
            if (errCampanias) {
                console.error(errCampanias);
                return res.status(500).send('No fue posible cargar el catálogo.');
            }

            res.render('modules/adminCatalogo', {
                totalProductos: productos.length,
                totalCampaniasVigentes: campanias.length
            });
        });
    });
};

exports.campanas = (req, res) => {
    campaniaModel.obtenerTodas((err, campanias) => {
        if (err) {
            console.error(err);
            return res.status(500).send('No fue posible cargar las campañas.');
        }

        const campaniasNormalizadas = campanias.map(normalizarCampania);
        res.render('modules/adminCampanas', {
            campanias: campaniasNormalizadas,
            totalCampanias: campaniasNormalizadas.length,
            totalActivas: campaniasNormalizadas.filter(item => item.estatus === 1).length
        });
    });
};

exports.reportes = (req, res) => {
    res.render('modules/adminReportes');
};

exports.auditoria = (req, res) => {
    bitacoraModel.listarRecientes((err, logs) => {
        if (err) {
            console.error(err);
            return res.status(500).send('No fue posible cargar la bitácora.');
        }

        res.render('modules/adminAuditoria', {
            logs: logs
        });
    });
};

exports.registrarSKU = (req, res) => {
    renderCatalogoRegistro(res);
};

exports.registrarSKUPost = (req, res) => {
    const validacion = validarProducto(req.body);

    if (!validacion.valido) {
        return renderCatalogoRegistro(res, {
            pageMessage: {
                tipo: 'danger',
                texto: validacion.mensaje
            },
            formData: validacion.formData
        });
    }

    productoModel.obtenerPorSku(validacion.producto.sku, (errSku, productoExistente) => {
        if (errSku) {
            console.error(errSku);
            return renderCatalogoRegistro(res, {
                pageMessage: {
                    tipo: 'danger',
                    texto: 'No fue posible validar el SKU capturado.'
                },
                formData: validacion.formData
            });
        }

        if (productoExistente) {
            return renderCatalogoRegistro(res, {
                pageMessage: {
                    tipo: 'danger',
                    texto: 'El SKU ingresado ya se encuentra registrado.'
                },
                formData: validacion.formData
            });
        }

        campaniaModel.obtenerPorId(validacion.producto.id_campania, (errCampania, campania) => {
            if (errCampania) {
                console.error(errCampania);
                return renderCatalogoRegistro(res, {
                    pageMessage: {
                        tipo: 'danger',
                        texto: 'No fue posible validar la campaña seleccionada.'
                    },
                    formData: validacion.formData
                });
            }

            const campaniaInvalida =
                !campania || new Date(campania.fecha_fin) < new Date(new Date().toDateString());

            if (campaniaInvalida) {
                return renderCatalogoRegistro(res, {
                    pageMessage: {
                        tipo: 'danger',
                        texto: 'La campaña seleccionada no es válida.'
                    },
                    formData: validacion.formData
                });
            }

            productoModel.registrar(validacion.producto, (errRegistro) => {
                if (errRegistro) {
                    console.error(errRegistro);
                    bitacoraModel.registrar(
                        req.session.usuario.correo,
                        `Error al registrar el producto ${validacion.producto.sku}`,
                        req.ip
                    );
                    return renderCatalogoRegistro(res, {
                        pageMessage: {
                            tipo: 'danger',
                            texto: 'No fue posible registrar el producto. Intente nuevamente.'
                        },
                        formData: validacion.formData
                    });
                }

                bitacoraModel.registrar(
                    req.session.usuario.correo,
                    `Registro de producto ${validacion.producto.sku} en catálogo para campaña ${campania.id_campania}`,
                    req.ip
                );

                req.session.mensaje = {
                    tipo: 'success',
                    texto: 'Producto registrado correctamente en el catálogo.'
                };

                res.redirect('/admin/catalogo/registrar');
            });
        });
    });
};

exports.modificarSKU = (req, res) => {
    productoModel.listarProductosCatalogo((err, productos) => {
        if (err) {
            console.error(err);
            return res.status(500).send('No fue posible cargar los productos.');
        }

        res.render('modules/catalogoModificar', {
            productos: productos.map(normalizarProducto)
        });
    });
};

exports.cargaMasiva = (req, res) => {
    res.render('modules/catalogoCargaMasiva');
};

exports.crearCampana = (req, res) => {
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

    campaniaModel.crear({
        ...validacion.formData,
        estatus: 0
    }, (err) => {
        if (err) {
            console.error(err);
            bitacoraModel.registrar(
                req.session.usuario.correo,
                `Error al configurar la campaña ${validacion.formData.nombre}`,
                req.ip
            );
            return renderCampaniaCrear(res, {
                pageMessage: {
                    tipo: 'danger',
                    texto: 'No fue posible configurar la campaña. Intente nuevamente.'
                },
                formData: validacion.formData
            });
        }

        bitacoraModel.registrar(
            req.session.usuario.correo,
            `Registro de campaña ${validacion.formData.nombre}`,
            req.ip
        );

        req.session.mensaje = {
            tipo: 'success',
            texto: 'Campaña configurada correctamente.'
        };

        res.redirect('/admin/campanas/crear');
    });
};

exports.editarCampana = (req, res) => {
    renderCampaniaEditar(req, res);
};

exports.editarCampanaPost = (req, res) => {
    const idCampania = parseInt(req.params.id, 10);
    const validacion = validarCampania(req.body);

    if (Number.isNaN(idCampania)) {
        req.session.mensaje = {
            tipo: 'danger',
            texto: 'La campaña seleccionada no es válida.'
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
                texto: 'La campaña seleccionada no existe.'
            };
            return res.redirect('/admin/campanas/editar');
        }

        const guardarCambios = () => {
            campaniaModel.actualizar(idCampania, {
                ...validacion.formData,
                estatus: Number(campaniaActual.estatus) === 1 ? 1 : 0
            }, (err, result) => {
                if (err || !result.affectedRows) {
                    console.error(err);
                    bitacoraModel.registrar(
                        req.session.usuario.correo,
                        `Error al editar la campaña ${idCampania}`,
                        req.ip
                    );
                    return renderCampaniaEditar(req, res, {
                        idSeleccionado: idCampania,
                        pageMessage: {
                            tipo: 'danger',
                            texto: 'No fue posible actualizar la campaña. Intente nuevamente.'
                        },
                        formData: {
                            id_campania: idCampania,
                            ...validacion.formData
                        }
                    });
                }

                bitacoraModel.registrar(
                    req.session.usuario.correo,
                    `Edición de campaña ${idCampania}`,
                    req.ip
                );

                req.session.mensaje = {
                    tipo: 'success',
                    texto: 'Campaña configurada correctamente.'
                };

                res.redirect(`/admin/campanas/editar?id=${idCampania}`);
            });
        };
        return guardarCambios();
    });
};

exports.cancelacionCampana = (req, res) => {
    campaniaModel.obtenerTodas((err, campanias) => {
        if (err) {
            console.error(err);
            return res.status(500).send('No fue posible cargar las campañas.');
        }

        res.render('modules/campanaCancelacion', {
            campanias: campanias.map(normalizarCampania)
        });
    });
};

exports.estadoCampana = (req, res) => {
    res.redirect('/admin/campanas/editar');
};

exports.activarCampana = (req, res) => {
    const idCampania = parseInt(req.params.id, 10);

    if (Number.isNaN(idCampania)) {
        req.session.mensaje = {
            tipo: 'danger',
            texto: 'La campaña seleccionada no es válida.'
        };
        return res.redirect('/admin/campanas/editar');
    }

    campaniaModel.obtenerPorId(idCampania, (errCampania, campania) => {
        if (errCampania || !campania) {
            console.error(errCampania);
            req.session.mensaje = {
                tipo: 'danger',
                texto: 'La campaña seleccionada no existe.'
            };
            return res.redirect('/admin/campanas/editar');
        }

        campaniaModel.existeOtraCampaniaActiva(idCampania, (errActiva, existeOtraActiva) => {
            if (errActiva) {
                console.error(errActiva);
                req.session.mensaje = {
                    tipo: 'danger',
                    texto: 'No fue posible validar el estatus de las campañas.'
                };
                return res.redirect(`/admin/campanas/editar?id=${idCampania}`);
            }

            if (existeOtraActiva) {
                req.session.mensaje = {
                    tipo: 'danger',
                    texto: 'No puedes activar dos campañas a la vez. Si quieres activar otra, primero desactiva la que ya está activa.'
                };
                return res.redirect(`/admin/campanas/editar?id=${idCampania}`);
            }

            campaniaModel.actualizar(idCampania, {
                nombre: campania.nombre,
                fecha_inicio: new Date(campania.fecha_inicio).toISOString().slice(0, 10),
                fecha_fin: new Date(campania.fecha_fin).toISOString().slice(0, 10),
                banner: campania.banner,
                estatus: 1
            }, (errActualizar) => {
                if (errActualizar) {
                    console.error(errActualizar);
                    req.session.mensaje = {
                        tipo: 'danger',
                        texto: 'No fue posible activar la campaña. Intente nuevamente.'
                    };
                    return res.redirect(`/admin/campanas/editar?id=${idCampania}`);
                }

                bitacoraModel.registrar(
                    req.session.usuario.correo,
                    `Activación de campaña ${campania.nombre}`,
                    req.ip
                );

                req.session.mensaje = {
                    tipo: 'success',
                    texto: 'Campaña activada correctamente.'
                };

                res.redirect(`/admin/campanas/editar?id=${idCampania}`);
            });
        });
    });
};

exports.desactivarCampana = (req, res) => {
    const idCampania = parseInt(req.params.id, 10);

    if (Number.isNaN(idCampania)) {
        req.session.mensaje = {
            tipo: 'danger',
            texto: 'La campaña seleccionada no es válida.'
        };
        return res.redirect('/admin/campanas/editar');
    }

    campaniaModel.obtenerPorId(idCampania, (errCampania, campania) => {
        if (errCampania || !campania) {
            console.error(errCampania);
            req.session.mensaje = {
                tipo: 'danger',
                texto: 'La campaña seleccionada no existe.'
            };
            return res.redirect('/admin/campanas/editar');
        }

        campaniaModel.desactivar(idCampania, (errDesactivar) => {
            if (errDesactivar) {
                console.error(errDesactivar);
                bitacoraModel.registrar(
                    req.session.usuario.correo,
                    `Error al desactivar la campaña ${idCampania}`,
                    req.ip
                );
                req.session.mensaje = {
                    tipo: 'danger',
                    texto: 'No fue posible desactivar la campaña. Intente nuevamente.'
                };
                return res.redirect(`/admin/campanas/editar?id=${idCampania}`);
            }

            bitacoraModel.registrar(
                req.session.usuario.correo,
                `Desactivación de campaña ${campania.nombre}`,
                req.ip
            );

            req.session.mensaje = {
                tipo: 'success',
                texto: 'Campaña desactivada correctamente.'
            };

            res.redirect(`/admin/campanas/editar?id=${idCampania}`);
        });
    });
};
