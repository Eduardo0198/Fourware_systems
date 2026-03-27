const bitacoraModel = require('../models/bitacora.model');
const campaniaModel = require('../models/campania.model');
const productoModel = require('../models/producto.model');
const { registrarEvento, normalizarIp } = require('../utils/auditoria.helper');

function aNumeroDecimal(valor) {
    const numero = parseFloat(valor);
    return Number.isFinite(numero) ? numero : NaN;
}

function esFechaValida(valor) {
    return Boolean(valor) && !Number.isNaN(new Date(valor).getTime());
}

function registrarBitacora(req, accion, correo) {
    bitacoraModel.registrar(
        correo || req.session?.usuario?.correo || null,
        accion,
        normalizarIp(req.ip)
    );
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

        const idSeleccionado = parseInt(options.idSeleccionado || req.query.id, 10);
        const campaniasNormalizadas = campanias.map(normalizarCampania);
        const campaniaSeleccionada = campaniasNormalizadas.find(
            (item) => item.id_campania === idSeleccionado
        ) || campaniasNormalizadas[0] || null;

        res.render('modules/campanaEditar', {
            pageMessage: options.pageMessage || null,
            campanias: campaniasNormalizadas,
            campaniaSeleccionada,
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

    if (Object.values(formData).some((valor) => !valor)) {
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

    if ([precio, peso, volumen].some((valor) => Number.isNaN(valor) || valor <= 0)) {
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

    if (Object.values(formData).some((valor) => !valor)) {
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
    registrarEvento(req, 'Consulta de dashboard administrativo');
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

            registrarEvento(req, 'Consulta de catálogo administrativo');
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
        registrarEvento(req, 'Consulta de configuración de campañas');
        res.render('modules/adminCampanas', {
            campanias: campaniasNormalizadas,
            totalCampanias: campaniasNormalizadas.length,
            totalActivas: campaniasNormalizadas.filter((item) => item.estatus === 1).length
        });
    });
};

exports.reportes = (req, res) => {
    registrarEvento(req, 'Consulta de reportes administrativos');
    res.render('modules/adminReportes');
};

exports.auditoria = (req, res) => {
    const usuario = req.session.usuario;
    const consultaSolicitada = req.query.consultar === '1';
    const correo = String(req.query.usuario || '').trim();
    const fechaInicio = String(req.query.fecha_inicio || '').trim();
    const fechaFin = String(req.query.fecha_fin || '').trim();
    const filtros = {
        correo,
        fechaInicio,
        fechaFin
    };

    const renderAuditoria = (datosExtra = {}) => {
        res.render('modules/adminAuditoria', {
            filtros,
            registros: [],
            totalRegistros: 0,
            estadoConsulta: 'inicial',
            ...datosExtra
        });
    };

    if (!consultaSolicitada) {
        return renderAuditoria();
    }

    if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
        return renderAuditoria({
            estadoConsulta: 'error-validacion',
            mensaje: {
                tipo: 'warning',
                texto: 'El rango de fechas ingresado no es válido.'
            }
        });
    }

    bitacoraModel.obtenerRegistrosFiltrados(filtros, (err, registros) => {
        if (err) {
            registrarEvento(
                req,
                'Error al consultar bitácora de auditoría',
                usuario ? usuario.correo : null
            );

            return renderAuditoria({
                estadoConsulta: 'error-consulta',
                mensaje: {
                    tipo: 'danger',
                    texto: 'No fue posible consultar la bitácora de auditoría. Intente nuevamente.'
                }
            });
        }

        const totalRegistros = registros.length;
        const accionConsulta = totalRegistros > 0
            ? 'Consulta de bitácora de auditoría'
            : 'Consulta de bitácora de auditoría sin resultados';

        registrarEvento(req, accionConsulta, usuario ? usuario.correo : null);

        if (totalRegistros === 0) {
            return renderAuditoria({
                estadoConsulta: 'sin-resultados',
                mensaje: {
                    tipo: 'info',
                    texto: 'No se encontraron registros con los criterios seleccionados.'
                }
            });
        }

        return renderAuditoria({
            registros,
            totalRegistros,
            estadoConsulta: 'con-resultados',
            mensaje: {
                tipo: 'success',
                texto: `Se encontraron ${totalRegistros} registro(s) para los criterios seleccionados.`
            }
        });
    });
};

exports.registrarSKU = (req, res) => {
    registrarEvento(req, 'Consulta de registro de producto de catálogo');
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
                    registrarBitacora(
                        req,
                        `Error al registrar el producto ${validacion.producto.sku}`
                    );
                    return renderCatalogoRegistro(res, {
                        pageMessage: {
                            tipo: 'danger',
                            texto: 'No fue posible registrar el producto. Intente nuevamente.'
                        },
                        formData: validacion.formData
                    });
                }

                registrarBitacora(
                    req,
                    `Registro de producto ${validacion.producto.sku} en catálogo para campaña ${campania.id_campania}`
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

        registrarEvento(req, 'Consulta de modificación de producto de catálogo');
        res.render('modules/catalogoModificar', {
            productos: productos.map(normalizarProducto)
        });
    });
};

exports.cargaMasiva = (req, res) => {
    registrarEvento(req, 'Consulta de carga masiva de productos');
    res.render('modules/catalogoCargaMasiva');
};

exports.crearCampana = (req, res) => {
    registrarEvento(req, 'Consulta de creación de campaña');
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
            registrarBitacora(
                req,
                `Error al configurar la campaña ${validacion.formData.nombre}`
            );
            return renderCampaniaCrear(res, {
                pageMessage: {
                    tipo: 'danger',
                    texto: 'No fue posible configurar la campaña. Intente nuevamente.'
                },
                formData: validacion.formData
            });
        }

        registrarBitacora(req, `Registro de campaña ${validacion.formData.nombre}`);

        req.session.mensaje = {
            tipo: 'success',
            texto: 'Campaña configurada correctamente.'
        };

        res.redirect('/admin/campanas/crear');
    });
};

exports.editarCampana = (req, res) => {
    registrarEvento(req, 'Consulta de edición de campaña');
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

        campaniaModel.actualizar(
            idCampania,
            {
                ...validacion.formData,
                estatus: Number(campaniaActual.estatus) === 1 ? 1 : 0
            },
            (err, result) => {
                if (err || !result.affectedRows) {
                    console.error(err);
                    registrarBitacora(req, `Error al editar la campaña ${idCampania}`);
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

                registrarBitacora(req, `Edición de campaña ${idCampania}`);

                req.session.mensaje = {
                    tipo: 'success',
                    texto: 'Campaña configurada correctamente.'
                };

                res.redirect(`/admin/campanas/editar?id=${idCampania}`);
            }
        );
    });
};

exports.cancelacionCampana = (req, res) => {
    campaniaModel.obtenerTodas((err, campanias) => {
        if (err) {
            console.error(err);
            return res.status(500).send('No fue posible cargar las campañas.');
        }

        registrarEvento(req, 'Consulta de configuración de cancelación de reservas');
        res.render('modules/campanaCancelacion', {
            campanias: campanias.map(normalizarCampania)
        });
    });
};

exports.estadoCampana = (req, res) => {
    registrarEvento(req, 'Consulta de estado de campaña');
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
                            texto: 'No fue posible activar la campaña. Intente nuevamente.'
                        };
                        return res.redirect(`/admin/campanas/editar?id=${idCampania}`);
                    }

                    registrarBitacora(req, `Activación de campaña ${campania.nombre}`);

                    req.session.mensaje = {
                        tipo: 'success',
                        texto: 'Campaña activada correctamente.'
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
                registrarBitacora(req, `Error al desactivar la campaña ${idCampania}`);
                req.session.mensaje = {
                    tipo: 'danger',
                    texto: 'No fue posible desactivar la campaña. Intente nuevamente.'
                };
                return res.redirect(`/admin/campanas/editar?id=${idCampania}`);
            }

            registrarBitacora(req, `Desactivación de campaña ${campania.nombre}`);

            req.session.mensaje = {
                tipo: 'success',
                texto: 'Campaña desactivada correctamente.'
            };

            res.redirect(`/admin/campanas/editar?id=${idCampania}`);
        });
    });
};
