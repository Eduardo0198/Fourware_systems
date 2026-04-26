const path = require('path');
const XLSX = require('xlsx');
const logger = require('../../utils/logger');
const { subirImagenProducto } = require('../../services/storage.service');
const {
    aNumeroDecimal,
    campaniaModel,
    normalizarCampania,
    normalizarProducto,
    productoModel,
    registrarBitacora,
    registrarEvento
} = require('./shared');

const COLUMNAS_CARGA_MASIVA = [
    'SKU',
    'nombre_comercial',
    'descripcion',
    'precio_unitario',
    'peso_unitario',
    'volumen_unitario',
    'medida_primaria',
    'unidad_venta',
    'imagen'
];

const EXTENSIONES_CARGA_MASIVA = new Set(['.csv', '.xlsx', '.xls']);

function normalizarEncabezadoCarga(valor) {
    return String(valor || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function esArchivoCargaMasivaPermitido(nombreArchivo) {
    return EXTENSIONES_CARGA_MASIVA.has(
        path.extname(String(nombreArchivo || '')).toLowerCase()
    );
}

function leerArchivoCargaMasiva(buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const nombreHoja = workbook.SheetNames[0];

    if (!nombreHoja) {
        throw new Error('El archivo no contiene hojas o datos legibles.');
    }

    const hoja = workbook.Sheets[nombreHoja];
    const matriz = XLSX.utils.sheet_to_json(hoja, {
        header: 1,
        defval: '',
        blankrows: false
    });

    if (!matriz.length) {
        return {
            nombreHoja,
            encabezadosDetectados: [],
            filas: [],
            encabezadosValidos: false,
            encabezadosFaltantes: COLUMNAS_CARGA_MASIVA,
            encabezadosDuplicados: []
        };
    }

    const encabezadosDetectados = (matriz[0] || []).map((valor) => String(valor || '').trim());
    const mapaIndices = {};
    const encabezadosDuplicados = [];

    encabezadosDetectados.forEach((encabezado, indice) => {
        const encabezadoCanonico = COLUMNAS_CARGA_MASIVA.find(
            (columna) => normalizarEncabezadoCarga(columna) === normalizarEncabezadoCarga(encabezado)
        );

        if (!encabezadoCanonico) {
            return;
        }

        if (Object.prototype.hasOwnProperty.call(mapaIndices, encabezadoCanonico)) {
            encabezadosDuplicados.push(encabezadoCanonico);
            return;
        }

        mapaIndices[encabezadoCanonico] = indice;
    });

    const encabezadosFaltantes = COLUMNAS_CARGA_MASIVA.filter(
        (columna) => !Object.prototype.hasOwnProperty.call(mapaIndices, columna)
    );

    const filas = matriz
        .slice(1)
        .map((fila, indice) => ({
            numeroFila: indice + 2,
            valores: fila
        }))
        .filter((fila) => fila.valores.some((valor) => String(valor || '').trim() !== ''))
        .map((fila) => {
            const registro = {};

            COLUMNAS_CARGA_MASIVA.forEach((columna) => {
                const indice = mapaIndices[columna];
                registro[columna] = indice === undefined ? '' : String(fila.valores[indice] || '').trim();
            });

            return {
                numeroFila: fila.numeroFila,
                registro
            };
        });

    return {
        nombreHoja,
        encabezadosDetectados,
        filas,
        encabezadosValidos: encabezadosFaltantes.length === 0 && encabezadosDuplicados.length === 0,
        encabezadosFaltantes,
        encabezadosDuplicados
    };
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
            mensaje: 'Precio, peso y volumen deben ser numeros mayores a cero.',
            formData
        };
    }

    if (Number.isNaN(idCampania)) {
        return {
            valido: false,
            mensaje: 'Debes seleccionar una campana valida.',
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
            activo: 1
        }
    };
}

function construirResumenPreliminarCarga(lectura, skusExistentes = []) {
    const skusVistos = new Set();
    const skusExistentesSet = new Set(skusExistentes.map((sku) => String(sku).trim().toUpperCase()));
    const filasValidas = [];
    const filasInvalidas = [];
    const filasOmitidas = [];
    let duplicadosInternos = 0;

    lectura.filas.forEach((fila) => {
        const validacion = validarProducto({
            sku: fila.registro.SKU,
            nombre_comercial: fila.registro.nombre_comercial,
            descripcion: fila.registro.descripcion,
            unidad_venta: fila.registro.unidad_venta,
            medida_primaria: fila.registro.medida_primaria,
            precio_unitario: fila.registro.precio_unitario,
            peso_unitario: fila.registro.peso_unitario,
            volumen_unitario: fila.registro.volumen_unitario,
            imagen: fila.registro.imagen,
            id_campania: lectura.idCampania
        });

        if (!validacion.valido) {
            filasInvalidas.push({
                numeroFila: fila.numeroFila,
                sku: String(fila.registro.SKU || '').trim().toUpperCase() || 'SIN SKU',
                motivo: validacion.mensaje
            });
            return;
        }

        const sku = validacion.producto.sku;

        if (skusVistos.has(sku)) {
            duplicadosInternos += 1;
            filasInvalidas.push({
                numeroFila: fila.numeroFila,
                sku,
                motivo: 'El SKU se encuentra duplicado dentro del mismo archivo.'
            });
            return;
        }

        skusVistos.add(sku);

        if (skusExistentesSet.has(sku)) {
            filasOmitidas.push({
                numeroFila: fila.numeroFila,
                sku,
                motivo: 'El SKU ya existe en el catalogo.'
            });
            return;
        }

        filasValidas.push({
            numeroFila: fila.numeroFila,
            sku,
            nombre_comercial: validacion.producto.nombre_comercial,
            precio_unitario: validacion.producto.precio_unitario,
            unidad_venta: validacion.producto.unidad_venta,
            producto: {
                ...validacion.producto,
                activo: 1
            }
        });
    });

    return {
        archivo: lectura.nombreArchivo,
        hoja: lectura.nombreHoja,
        totalFilas: lectura.filas.length,
        encabezadosDetectados: lectura.encabezadosDetectados,
        encabezadosEsperados: COLUMNAS_CARGA_MASIVA,
        encabezadosValidos: lectura.encabezadosValidos,
        encabezadosFaltantes: lectura.encabezadosFaltantes,
        encabezadosDuplicados: lectura.encabezadosDuplicados,
        filasListasParaCarga: filasValidas.length,
        filasOmitidas: filasOmitidas.length,
        filasConError: filasInvalidas.length,
        filasConSkuDuplicado: duplicadosInternos,
        previewValidas: filasValidas.slice(0, 10),
        previewOmitidas: filasOmitidas.slice(0, 10),
        previewErrores: filasInvalidas.slice(0, 10),
        productosParaInsertar: filasValidas.map((fila) => fila.producto)
    };
}

function renderCatalogoRegistro(res, options = {}) {
    campaniaModel.obtenerSeleccionablesParaCatalogo((errCampanias, campanias) => {
        if (errCampanias) {
            logger.error(errCampanias);
            return res.status(500).send('No fue posible cargar las campanas.');
        }

        productoModel.listarProductosCatalogoRecientes((errProductos, productos) => {
            if (errProductos) {
                logger.error(errProductos);
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
            logger.error(errCampanias);
            return res.status(500).send('No fue posible cargar las campanas.');
        }

        productoModel.listarProductosCatalogo((errProductos, productos) => {
            if (errProductos) {
                logger.error(errProductos);
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

function renderCatalogoCargaMasiva(res, options = {}) {
    campaniaModel.obtenerSeleccionablesParaCatalogo((errCampanias, campanias) => {
        if (errCampanias) {
            logger.error(errCampanias);
            return res.status(500).send('No fue posible cargar las campanas.');
        }

        res.render('modules/catalogoCargaMasiva', {
            pageMessage: options.pageMessage || res.locals.mensaje || null,
            formData: options.formData || {},
            campanias: campanias.map(normalizarCampania),
            resumen: options.resumen || null,
            columnasEsperadas: COLUMNAS_CARGA_MASIVA
        });
    });
}

exports.catalogo = (req, res) => {
    productoModel.listarProductosCatalogo((errProductos, productos) => {
        if (errProductos) {
            logger.error(errProductos);
            return res.status(500).send('No fue posible cargar el catalogo.');
        }

        campaniaModel.obtenerSeleccionablesParaCatalogo((errCampanias, campanias) => {
            if (errCampanias) {
                logger.error(errCampanias);
                return res.status(500).send('No fue posible cargar el catalogo.');
            }

            registrarEvento(req, 'Consulta de catalogo administrativo');
            res.render('modules/adminCatalogo', {
                totalProductos: productos.length,
                totalCampaniasVigentes: campanias.length
            });
        });
    });
};

exports.registrarSKU = (req, res) => {
    registrarEvento(req, 'Consulta de registro de producto de catalogo');
    renderCatalogoRegistro(res);
};

exports.registrarSKUPost = async (req, res) => {
    if (req.file) {
        try {
            const sku = String(req.body.sku || '').trim().toUpperCase();
            req.body.imagen = await subirImagenProducto(req.file.buffer, sku, req.file.mimetype);
        } catch (err) {
            logger.error(err);
            return renderCatalogoRegistro(res, {
                pageMessage: { tipo: 'danger', texto: 'No fue posible subir la imagen. Intente nuevamente.' },
                formData: req.body
            });
        }
    }

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
            logger.error(errSku);
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
                logger.error(errCampania);
                return renderCatalogoRegistro(res, {
                    pageMessage: {
                        tipo: 'danger',
                        texto: 'No fue posible validar la campana seleccionada.'
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
                        texto: 'La campana seleccionada no es valida.'
                    },
                    formData: validacion.formData
                });
            }

            productoModel.registrar(validacion.producto, (errRegistro) => {
                if (errRegistro) {
                    logger.error(errRegistro);
                    registrarBitacora(req, `Error al registrar el producto ${validacion.producto.sku}`);
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
                    `Registro de producto ${validacion.producto.sku} en catalogo para campania ${campania.id_campania}`
                );

                req.session.mensaje = {
                    tipo: 'success',
                    texto: 'Producto registrado correctamente en el catalogo.'
                };

                res.redirect('/admin/catalogo/registrar');
            });
        });
    });
};

exports.modificarSKU = (req, res) => {
    const sku = String(req.query.sku || '').trim().toUpperCase();

    if (!sku) {
        registrarEvento(req, 'Consulta de modificacion de producto de catalogo');
        return renderCatalogoModificar(req, res);
    }

    productoModel.obtenerPorSku(sku, (err, producto) => {
        if (err) {
            logger.error(err);
            return res.status(500).send('No fue posible cargar el producto seleccionado.');
        }

        if (!producto || Number(producto.activo) !== 1) {
            registrarBitacora(req, `Intento de edicion de producto no disponible ${sku}`);

            return renderCatalogoModificar(req, res, {
                pageMessage: {
                    tipo: 'warning',
                    texto: 'El producto seleccionado no existe o ya no se encuentra disponible para edicion.'
                }
            });
        }

        registrarEvento(req, `Consulta de edicion de producto ${sku}`);
        return renderCatalogoModificar(req, res, {
            skuSeleccionado: sku
        });
    });
};

exports.modificarSKUPost = async (req, res) => {
    const sku = String(req.params.sku || '').trim().toUpperCase();

    if (req.file) {
        try {
            req.body.imagen = await subirImagenProducto(req.file.buffer, sku, req.file.mimetype);
        } catch (err) {
            logger.error(err);
            return renderCatalogoModificar(req, res, {
                skuSeleccionado: sku,
                formData: req.body,
                pageMessage: { tipo: 'danger', texto: 'No fue posible subir la imagen. Intente nuevamente.' }
            });
        }
    }

    const validacion = validarProducto({
        ...req.body,
        sku
    });

    if (!validacion.valido) {
        registrarBitacora(req, `Intento de actualizacion con datos invalidos para producto ${sku}`);
        return renderCatalogoModificar(req, res, {
            skuSeleccionado: sku,
            formData: validacion.formData,
            pageMessage: {
                tipo: 'danger',
                texto: 'Ingrese datos validos.'
            }
        });
    }

    productoModel.obtenerPorSku(sku, (errProducto, productoExistente) => {
        if (errProducto) {
            logger.error(errProducto);
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
            registrarBitacora(req, `Intento de actualizacion de producto no disponible ${sku}`);
            return renderCatalogoModificar(req, res, {
                pageMessage: {
                    tipo: 'warning',
                    texto: 'El producto seleccionado no existe o ya no se encuentra disponible para edicion.'
                }
            });
        }

        campaniaModel.obtenerPorId(validacion.producto.id_campania, (errCampania, campania) => {
            if (errCampania) {
                logger.error(errCampania);
                return renderCatalogoModificar(req, res, {
                    skuSeleccionado: sku,
                    formData: validacion.formData,
                    pageMessage: {
                        tipo: 'danger',
                        texto: 'No fue posible validar la campana seleccionada.'
                    }
                });
            }

            if (!campania) {
                registrarBitacora(req, `Intento de actualizacion con campania invalida para producto ${sku}`);
                return renderCatalogoModificar(req, res, {
                    skuSeleccionado: sku,
                    formData: validacion.formData,
                    pageMessage: {
                        tipo: 'danger',
                        texto: 'La campana seleccionada no es valida.'
                    }
                });
            }

            const nuevoSku = validacion.producto.sku;
            const skuCambio = nuevoSku !== sku;

            function guardarProducto(cb) {
                if (!skuCambio) {
                    return productoModel.actualizarPorSku(sku, validacion.producto, cb);
                }
                productoModel.obtenerPorSku(nuevoSku, (errExiste, yaExiste) => {
                    if (errExiste) return cb(errExiste);
                    if (yaExiste) {
                        return cb({ skuDuplicado: true });
                    }
                    productoModel.actualizarSkuCompleto(sku, nuevoSku, validacion.producto, cb);
                });
            }

            guardarProducto((errActualizacion) => {
                if (errActualizacion?.skuDuplicado) {
                    return renderCatalogoModificar(req, res, {
                        skuSeleccionado: sku,
                        formData: validacion.formData,
                        pageMessage: { tipo: 'danger', texto: 'El nuevo SKU ya existe en el catálogo.' }
                    });
                }
                if (errActualizacion) {
                    logger.error(errActualizacion);
                    registrarBitacora(req, `Error al actualizar la informacion del producto ${sku}`);
                    return renderCatalogoModificar(req, res, {
                        skuSeleccionado: sku,
                        formData: validacion.formData,
                        pageMessage: { tipo: 'danger', texto: 'No fue posible actualizar la informacion del producto. Intente nuevamente.' }
                    });
                }

                registrarBitacora(req, `Actualizacion de atributos del producto ${sku}${skuCambio ? ` → ${nuevoSku}` : ''}`);
                req.session.mensaje = { tipo: 'success', texto: 'Informacion del producto actualizada correctamente.' };
                return res.redirect(`/admin/catalogo/modificar?sku=${encodeURIComponent(nuevoSku)}`);
            });
        });
    });
};

exports.eliminarSKUPost = (req, res) => {
    const sku = String(req.params.sku || '').trim().toUpperCase();

    if (!sku) {
        req.session.mensaje = {
            tipo: 'danger',
            texto: 'Debes seleccionar un producto valido para eliminar.'
        };
        return res.redirect('/admin/catalogo/modificar');
    }

    productoModel.obtenerPorSku(sku, (errProducto, productoExistente) => {
        if (errProducto) {
            logger.error(errProducto);
            registrarBitacora(req, `Error al consultar producto ${sku} para eliminacion`);
            req.session.mensaje = {
                tipo: 'danger',
                texto: 'No fue posible validar el producto seleccionado.'
            };
            return res.redirect('/admin/catalogo/modificar');
        }

        if (!productoExistente) {
            registrarBitacora(req, `Intento de eliminacion de producto inexistente ${sku}`);
            req.session.mensaje = {
                tipo: 'warning',
                texto: 'El producto seleccionado no existe en el catalogo.'
            };
            return res.redirect('/admin/catalogo/modificar');
        }

        productoModel.contarHistorialPorSku(sku, (errHistorial, historial) => {
            if (errHistorial) {
                logger.error(errHistorial);
                registrarBitacora(req, `Error al validar historial del producto ${sku}`);
                req.session.mensaje = {
                    tipo: 'danger',
                    texto: 'No fue posible validar el historial del producto.'
                };
                return res.redirect('/admin/catalogo/modificar');
            }

            const tieneHistorial = Number(historial.total || 0) > 0;
            const operacion = tieneHistorial
                ? productoModel.retirarDelCatalogo
                : productoModel.eliminarPorSku;

            operacion(sku, (errEliminacion) => {
                if (errEliminacion) {
                    logger.error(errEliminacion);
                    registrarBitacora(req, `Error al eliminar producto ${sku} del catalogo`);
                    req.session.mensaje = {
                        tipo: 'danger',
                        texto: 'No fue posible eliminar el producto del catalogo. Intente nuevamente.'
                    };
                    return res.redirect('/admin/catalogo/modificar');
                }

                const accion = tieneHistorial
                    ? `Retiro logico de producto ${sku} del catalogo conservando historial`
                    : `Eliminacion fisica de producto ${sku} del catalogo`;

                registrarBitacora(req, accion);

                req.session.mensaje = {
                    tipo: 'success',
                    texto: tieneHistorial
                        ? 'El producto fue retirado del catalogo conservando su historial.'
                        : 'Producto eliminado correctamente del catalogo.'
                };

                return res.redirect('/admin/catalogo/modificar');
            });
        });
    });
};

exports.cargaMasiva = (req, res) => {
    registrarEvento(req, 'Consulta de carga masiva de productos');
    renderCatalogoCargaMasiva(res);
};

exports.cargaMasivaPost = (req, res) => {
    const formData = {
        id_campania: String(req.body.id_campania || '').trim()
    };

    if (!formData.id_campania) {
        return renderCatalogoCargaMasiva(res, {
            pageMessage: {
                tipo: 'danger',
                texto: 'Debes seleccionar una campana para validar la carga masiva.'
            },
            formData
        });
    }

    if (!req.file) {
        return renderCatalogoCargaMasiva(res, {
            pageMessage: {
                tipo: 'danger',
                texto: 'Debes adjuntar un archivo CSV o Excel.'
            },
            formData
        });
    }

    if (!esArchivoCargaMasivaPermitido(req.file.originalname)) {
        return renderCatalogoCargaMasiva(res, {
            pageMessage: {
                tipo: 'danger',
                texto: 'El archivo debe estar en formato CSV o Excel.'
            },
            formData
        });
    }

    const idCampania = parseInt(formData.id_campania, 10);

    if (Number.isNaN(idCampania)) {
        return renderCatalogoCargaMasiva(res, {
            pageMessage: {
                tipo: 'danger',
                texto: 'Debes seleccionar una campana valida.'
            },
            formData
        });
    }

    campaniaModel.obtenerPorId(idCampania, (errCampania, campania) => {
        if (errCampania) {
            logger.error(errCampania);
            return renderCatalogoCargaMasiva(res, {
                pageMessage: {
                    tipo: 'danger',
                    texto: 'No fue posible validar la campana seleccionada.'
                },
                formData
            });
        }

        const hoy = new Date(new Date().toDateString());
        const campaniaInvalida = !campania || new Date(campania.fecha_fin) < hoy;

        if (campaniaInvalida) {
            return renderCatalogoCargaMasiva(res, {
                pageMessage: {
                    tipo: 'danger',
                    texto: 'La campana seleccionada no es valida para la carga.'
                },
                formData
            });
        }

        try {
            const lectura = leerArchivoCargaMasiva(req.file.buffer);
            const lecturaConContexto = {
                ...lectura,
                idCampania,
                nombreArchivo: req.file.originalname
            };

            if (!lectura.encabezadosValidos) {
                const resumen = construirResumenPreliminarCarga(lecturaConContexto);

                registrarBitacora(req, `Validacion fallida de encabezados en carga masiva ${req.file.originalname}`);
                return renderCatalogoCargaMasiva(res, {
                    pageMessage: {
                        tipo: 'warning',
                        texto: 'El archivo fue leido, pero los encabezados no coinciden con la plantilla esperada.'
                    },
                    formData,
                    resumen
                });
            }

            if (lectura.filas.length === 0) {
                const resumen = construirResumenPreliminarCarga(lecturaConContexto);

                return renderCatalogoCargaMasiva(res, {
                    pageMessage: {
                        tipo: 'warning',
                        texto: 'El archivo no contiene filas con datos para validar.'
                    },
                    formData,
                    resumen
                });
            }

            const skusArchivo = lectura.filas
                .map((fila) => String(fila.registro.SKU || '').trim().toUpperCase())
                .filter(Boolean);

            productoModel.obtenerPorSkus(skusArchivo, (errSkus, productosExistentes) => {
                if (errSkus) {
                    logger.error(errSkus);
                    registrarBitacora(req, `Error al consultar SKUs existentes para carga masiva ${req.file.originalname}`);
                    return renderCatalogoCargaMasiva(res, {
                        pageMessage: {
                            tipo: 'danger',
                            texto: 'No fue posible validar los productos existentes en el catalogo.'
                        },
                        formData
                    });
                }

                const skusExistentes = productosExistentes.map((producto) => producto.SKU);
                const resumen = construirResumenPreliminarCarga(lecturaConContexto, skusExistentes);

                if (resumen.productosParaInsertar.length === 0) {
                    registrarBitacora(
                        req,
                        `Carga masiva sin inserciones para archivo ${req.file.originalname} en campania ${campania.id_campania}`
                    );

                    return renderCatalogoCargaMasiva(res, {
                        pageMessage: {
                            tipo: resumen.filasConError > 0 || resumen.filasOmitidas > 0 ? 'warning' : 'info',
                            texto: 'No hubo productos nuevos para insertar. Revisa el resumen de omitidos y errores.'
                        },
                        formData,
                        resumen: {
                            ...resumen,
                            filasInsertadas: 0
                        }
                    });
                }

                productoModel.registrarMultiples(resumen.productosParaInsertar, (errRegistro, resultado) => {
                    if (errRegistro) {
                        logger.error(errRegistro);
                        registrarBitacora(req, `Error en carga masiva ${req.file.originalname}`);

                        return renderCatalogoCargaMasiva(res, {
                            pageMessage: {
                                tipo: 'danger',
                                texto: 'No fue posible registrar los productos validados en el catalogo.'
                            },
                            formData,
                            resumen
                        });
                    }

                    registrarBitacora(
                        req,
                        `Carga masiva de ${resultado.affectedRows} producto(s) desde archivo ${req.file.originalname} en campania ${campania.id_campania}`
                    );

                    return renderCatalogoCargaMasiva(res, {
                        pageMessage: {
                            tipo: resumen.filasConError > 0 || resumen.filasOmitidas > 0 ? 'warning' : 'success',
                            texto: resumen.filasConError > 0 || resumen.filasOmitidas > 0
                                ? `Se insertaron ${resultado.affectedRows} producto(s). Tambien hubo registros omitidos o con error.`
                                : `Se insertaron correctamente ${resultado.affectedRows} producto(s) en el catalogo.`
                        },
                        formData,
                        resumen: {
                            ...resumen,
                            filasInsertadas: resultado.affectedRows
                        }
                    });
                });
            });
        } catch (error) {
            logger.error(error);
            registrarBitacora(req, `Error al leer archivo de carga masiva ${req.file.originalname}`);
            return renderCatalogoCargaMasiva(res, {
                pageMessage: {
                    tipo: 'danger',
                    texto: 'No fue posible leer el archivo cargado. Verifica su contenido e intenta nuevamente.'
                },
                formData
            });
        }
    });
};

function renderCatalogoEstado(req, res, options = {}) {
    productoModel.listarProductosCatalogo((errProductos, productos) => {
        if (errProductos) {
            logger.error(errProductos);
            return res.status(500).send('No fue posible cargar el catalogo.');
        }

        res.render('modules/adminCatalogoEstado', {
            pageMessage: options.pageMessage || res.locals.mensaje || null,
            productos: productos.map(normalizarProducto)
        });
    });
}

exports.estadoCatalogo = (req, res) => {
    registrarEvento(req, 'Consulta de estado de productos del catalogo');
    renderCatalogoEstado(req, res);
};

exports.toggleEstadoProducto = (req, res) => {
    const sku = String(req.params.sku || '').trim().toUpperCase();

    productoModel.obtenerPorSku(sku, (errProducto, producto) => {
        if (errProducto) {
            logger.error(errProducto);
            return res.redirect('/admin/catalogo/estado');
        }

        if (!producto) {
            registrarBitacora(req, `Intento de cambio de estado de producto no encontrado: ${sku}`);
            req.session.mensaje = {
                tipo: 'warning',
                texto: 'Producto no encontrado.'
            };
            return res.redirect('/admin/catalogo/estado');
        }

        const nuevoEstado = Number(producto.activo) === 1 ? 0 : 1;
        const accionTexto = nuevoEstado === 1 ? 'activado' : 'desactivado';

        productoModel.actualizarEstado(sku, nuevoEstado, (errActualizar) => {
            if (errActualizar) {
                logger.error(errActualizar);
                registrarBitacora(req, `Error al cambiar estado de producto ${sku}`);
                req.session.mensaje = {
                    tipo: 'danger',
                    texto: 'No fue posible cambiar el estado del producto. Intente nuevamente.'
                };
                return res.redirect('/admin/catalogo/estado');
            }

            registrarBitacora(req, `Producto ${accionTexto}: ${sku}`);
            req.session.mensaje = {
                tipo: 'success',
                texto: `Producto ${sku} ${accionTexto} correctamente.`
            };
            return res.redirect('/admin/catalogo/estado');
        });
    });
};
