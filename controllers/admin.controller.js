const bitacoraModel = require('../models/bitacora.model');
const campaniaModel = require('../models/campania.model');
const cancelacionModel = require('../models/cancelacion.model');
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
                pageMessage: options.pageMessage || res.locals.mensaje || null,
                formData: options.formData || {},
                campanias: campanias.map(normalizarCampania),
                productos: productos.map(normalizarProducto)
            });
        });
    });
}

function renderCatalogoModificar(req, res, options = {}) {
    campaniaModel.obtenerTodas((errCampanias, campanias) => {
        if (errCampanias) {
            console.error(errCampanias);
            return res.status(500).send('No fue posible cargar las campañas.');
        }

        productoModel.listarProductosCatalogo((errProductos, productos) => {
            if (errProductos) {
                console.error(errProductos);
                return res.status(500).send('No fue posible cargar los productos.');
            }

            const productosNormalizados = productos.map(normalizarProducto);
            const skuSeleccionado = String(
                options.skuSeleccionado
                || options.formData?.sku
                || req.query.sku
                || ''
            ).trim().toUpperCase();

            const productoSeleccionado = skuSeleccionado
                ? productosNormalizados.find((producto) => producto.SKU === skuSeleccionado) || null
                : null;

            const formData = options.formData || (productoSeleccionado
                ? {
                    sku: productoSeleccionado.SKU,
                    nombre_comercial: productoSeleccionado.nombre_comercial,
                    descripcion: productoSeleccionado.descripcion,
                    unidad_venta: productoSeleccionado.unidad_venta,
                    medida_primaria: productoSeleccionado.medida_primaria,
                    precio_unitario: productoSeleccionado.precio_unitario,
                    peso_unitario: productoSeleccionado.peso_unitario,
                    volumen_unitario: productoSeleccionado.volumen_unitario,
                    imagen: productoSeleccionado.imagen,
                    id_campania: productoSeleccionado.id_campania
                }
                : {});

            res.render('modules/catalogoModificar', {
                pageMessage: options.pageMessage || res.locals.mensaje || null,
                formData,
                campanias: campanias.map(normalizarCampania),
                productos: productosNormalizados,
                productoSeleccionado
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
            return res.status(500).send('No fue posible cargar las campañas.');
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

// inicio caso 8 lau
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
        return bitacoraModel.listarRecientes((err, registros) => {
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
                        texto: 'No fue posible cargar la bitácora de auditoría. Intente nuevamente.'
                    }
                });
            }

            registrarEvento(req, 'Consulta de bitácora de auditoría', usuario ? usuario.correo : null);

            return renderAuditoria({
                registros,
                totalRegistros: registros.length,
                estadoConsulta: registros.length > 0 ? 'con-resultados' : 'sin-resultados',
                mensaje: registros.length > 0
                    ? {
                        tipo: 'info',
                        texto: 'Se muestran los registros más recientes de la bitácora.'
                    }
                    : {
                        tipo: 'info',
                        texto: 'No hay registros disponibles en la bitácora.'
                    }
            });
        });
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
// fin caso 8 lau

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
    const sku = String(req.query.sku || '').trim().toUpperCase();

    if (!sku) {
        registrarEvento(req, 'Consulta de modificación de producto de catálogo');
        return renderCatalogoModificar(req, res);
    }

    productoModel.obtenerPorSku(sku, (err, producto) => {
        if (err) {
            console.error(err);
            return res.status(500).send('No fue posible cargar el producto seleccionado.');
        }

        if (!producto || Number(producto.activo) !== 1) {
            registrarBitacora(
                req,
                `Intento de edición de producto no disponible ${sku}`
            );

            return renderCatalogoModificar(req, res, {
                pageMessage: {
                    tipo: 'warning',
                    texto: 'El producto seleccionado no existe o ya no se encuentra disponible para edición.'
                }
            });
        }

        registrarEvento(req, `Consulta de edición de producto ${sku}`);
        return renderCatalogoModificar(req, res, {
            skuSeleccionado: sku
        });
    });
};

exports.modificarSKUPost = (req, res) => {
    const sku = String(req.params.sku || '').trim().toUpperCase();
    const validacion = validarProducto({
        ...req.body,
        sku
    });

    if (!validacion.valido) {
        registrarBitacora(
            req,
            `Intento de actualización con datos inválidos para producto ${sku}`
        );
        return renderCatalogoModificar(req, res, {
            skuSeleccionado: sku,
            formData: validacion.formData,
            pageMessage: {
                tipo: 'danger',
                texto: 'Ingrese datos válidos.'
            }
        });
    }

    productoModel.obtenerPorSku(sku, (errProducto, productoExistente) => {
        if (errProducto) {
            console.error(errProducto);
            return renderCatalogoModificar(req, res, {
                skuSeleccionado: sku,
                formData: validacion.formData,
                pageMessage: {
                    tipo: 'danger',
                    texto: 'No fue posible validar el producto seleccionado.'
                }
            });
        }

        if (!productoExistente || Number(productoExistente.activo) !== 1) {
            registrarBitacora(
                req,
                `Intento de actualización de producto no disponible ${sku}`
            );
            return renderCatalogoModificar(req, res, {
                pageMessage: {
                    tipo: 'warning',
                    texto: 'El producto seleccionado no existe o ya no se encuentra disponible para edición.'
                }
            });
        }

        campaniaModel.obtenerPorId(validacion.producto.id_campania, (errCampania, campania) => {
            if (errCampania) {
                console.error(errCampania);
                return renderCatalogoModificar(req, res, {
                    skuSeleccionado: sku,
                    formData: validacion.formData,
                    pageMessage: {
                        tipo: 'danger',
                        texto: 'No fue posible validar la campaña seleccionada.'
                    }
                });
            }

            const hoy = new Date(new Date().toDateString());
            const campaniaInvalida = !campania
                || Number(campania.estatus) !== 1
                || new Date(campania.fecha_inicio) > hoy
                || new Date(campania.fecha_fin) < hoy;

            if (campaniaInvalida) {
                registrarBitacora(
                    req,
                    `Intento de actualización con campaña inválida para producto ${sku}`
                );
                return renderCatalogoModificar(req, res, {
                    skuSeleccionado: sku,
                    formData: validacion.formData,
                    pageMessage: {
                        tipo: 'danger',
                        texto: 'La campaña seleccionada no es válida.'
                    }
                });
            }

            productoModel.actualizarPorSku(sku, validacion.producto, (errActualizacion) => {
                if (errActualizacion) {
                    console.error(errActualizacion);
                    registrarBitacora(
                        req,
                        `Error al actualizar la información del producto ${sku}`
                    );
                    return renderCatalogoModificar(req, res, {
                        skuSeleccionado: sku,
                        formData: validacion.formData,
                        pageMessage: {
                            tipo: 'danger',
                            texto: 'No fue posible actualizar la información del producto. Intente nuevamente.'
                        }
                    });
                }

                registrarBitacora(
                    req,
                    `Actualización de atributos del producto ${sku}`
                );

                req.session.mensaje = {
                    tipo: 'success',
                    texto: 'Información del producto actualizada correctamente.'
                };

                return res.redirect(`/admin/catalogo/modificar?sku=${encodeURIComponent(sku)}`);
            });
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
                        texto: 'No fue posible validar el periodo de la campaña.'
                    },
                    formData: validacion.formData
                });
            }

            if (existeConflicto) {
                return renderCampaniaCrear(res, {
                    pageMessage: {
                        tipo: 'danger',
                        texto: 'Existe otra campaña activa en el mismo periodo.'
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
        }
    );
};

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
                        texto: 'No fue posible validar el periodo de la campaña.'
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
                        texto: 'Existe otra campaña activa en el mismo periodo.'
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
        }
    );
}

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

        actualizarCampaniaValidada(req, res, idCampania, campaniaActual, validacion);
    });
};

exports.cancelacionCampana = (req, res) => {
    cancelacionModel.obtener((err, configuracion) => {
        if (err) {
            console.error(err);
            return res.status(500).send('No fue posible cargar la configuración de cancelación.');
        }

        registrarEvento(req, 'Consulta de configuración de cancelación de reservas');
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
                texto: 'Debes capturar una cantidad válida de horas para cancelar reservas.'
            },
            horasCancelacion: req.body.horas_cancelacion
        });
    }

    cancelacionModel.actualizar(horas, (err, configuracion) => {
        if (err) {
            console.error(err);
            registrarBitacora(req, 'Error al configurar la ventana de cancelación de reservas');
            return res.render('modules/campanaCancelacion', {
                pageMessage: {
                    tipo: 'danger',
                    texto: 'No fue posible guardar la ventana de cancelación. Intente nuevamente.'
                },
                horasCancelacion: req.body.horas_cancelacion
            });
        }

        registrarBitacora(
            req,
            `Configuración de ventana de cancelación a ${configuracion.horas_cancelacion} horas`
        );

        req.session.mensaje = {
            tipo: 'success',
            texto: 'Ventana de cancelación configurada correctamente.'
        };

        res.redirect('/admin/campanas/cancelacion');
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
