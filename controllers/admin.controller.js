// Agrego Xlss para lectura de Excel, fs y path para manejo de archivos, 
// y el modelo de bitácora para registrar eventos de auditoría relacionados con la carga masiva
const path = require('path');
const XLSX = require('xlsx');
const bitacoraModel = require('../models/bitacora.model');
const campaniaModel = require('../models/campania.model');
const cancelacionModel = require('../models/cancelacion.model');
const productoModel = require('../models/producto.model');
const { registrarEvento, normalizarIp } = require('../utils/auditoria.helper');


// CARGA MASIVA
// Columnas esperadas para la carga masiva de productos, 
// en el orden que se espera que estén en el archivo
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
// formatos de archivo permitidos para la carga masiva
const EXTENSIONES_CARGA_MASIVA = new Set(['.csv', '.xlsx', '.xls']);

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

// Quita espacios extra y convierte a minúsculas para facilitar 
// la comparación de encabezados
function normalizarEncabezadoCarga(valor) {
    return String(valor || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

// Valida que los formatos sean los permitidos 
// csv, xlsx o xls 
function esArchivoCargaMasivaPermitido(nombreArchivo) {
    return EXTENSIONES_CARGA_MASIVA.has(
        path.extname(String(nombreArchivo || '')).toLowerCase()
    );
}


// Lee el archivo de carga masiva y devuelve un objeto con la información 
// de los encabezados detectados, las filas con datos, y cualquier inconsistencia 
// encontrada en los encabezados
function leerArchivoCargaMasiva(buffer) {

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const nombreHoja = workbook.SheetNames[0];
    // Si no se encuentra una hoja o no se pueden leer los datos, 
    // se lanza un error para informar al usuario
    if (!nombreHoja) {
        throw new Error('El archivo no contiene hojas o datos legibles.');
    }

    // Convierte la hoja de Excel a una matriz de filas y columnas,
    // donde la primera fila se asume que contiene los encabezados
    const hoja = workbook.Sheets[nombreHoja];
    const matriz = XLSX.utils.sheet_to_json(hoja, {
        header: 1,
        defval: '',
        blankrows: false
    });

    // Si el archivo no contiene filas, se devuelve un resultado indicando 
    // que no se detectaron encabezados ni datos
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

    // Se procesan los encabezados detectados en la primera fila del archivo,
    const encabezadosDetectados = (matriz[0] || []).map((valor) => String(valor || '').trim());
    const mapaIndices = {};
    const encabezadosDuplicados = [];

    // Se comparan los encabezados detectados con las columnas esperadas
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

    // Se procesan las filas de datos a partir de la segunda fila del archivo
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

function construirResumenPreliminarCarga(lectura) {
    const skusVistos = new Set();
    const filasValidas = [];
    const filasInvalidas = [];
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

        // si no tiene formato válido, se agrega a las filas con error 
        // indicando el motivo de la invalidación
        if (!validacion.valido) {
            filasInvalidas.push({
                numeroFila: fila.numeroFila,
                sku: String(fila.registro.SKU || '').trim().toUpperCase() || 'SIN SKU',
                motivo: validacion.mensaje
            });
            return;
        }

        // si tiene formato válido, se verifica si el SKU ya se ha visto 
        // en este mismo archivo para detectar duplicados internos
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

        // los productos que pasan ambas validaciones se consideran 
        // filas listas para carga,
        skusVistos.add(sku);
        filasValidas.push({
            numeroFila: fila.numeroFila,
            sku,
            nombre_comercial: validacion.producto.nombre_comercial,
            precio_unitario: validacion.producto.precio_unitario,
            unidad_venta: validacion.producto.unidad_venta
        });
    });

    // finalmente se construye un resumen preliminar que incluye 
    // información sobre los encabezados detectados,
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
        filasConError: filasInvalidas.length,
        filasConSkuDuplicado: duplicadosInternos,
        previewValidas: filasValidas.slice(0, 10),
        previewErrores: filasInvalidas.slice(0, 10)
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

// función para renderizar la vista de carga masiva,
// que incluye la lista de campañas disponibles
function renderCatalogoCargaMasiva(res, options = {}) {
    campaniaModel.obtenerSeleccionablesParaCatalogo((errCampanias, campanias) => {
        if (errCampanias) {
            console.error(errCampanias);
            return res.status(500).send('No fue posible cargar las campanas.');
        }
        // se renderiza la vista de carga masiva pasando las campañas disponibles
        res.render('modules/catalogoCargaMasiva', {
            pageMessage: options.pageMessage || res.locals.mensaje || null,
            formData: options.formData || {},
            campanias: campanias.map(normalizarCampania),
            resumen: options.resumen || null,
            columnasEsperadas: COLUMNAS_CARGA_MASIVA
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
            console.error(errCampania);
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
            const resumen = construirResumenPreliminarCarga({
                ...lectura,
                idCampania,
                nombreArchivo: req.file.originalname
            });

            if (!lectura.encabezadosValidos) {
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

            if (resumen.totalFilas === 0) {
                return renderCatalogoCargaMasiva(res, {
                    pageMessage: {
                        tipo: 'warning',
                        texto: 'El archivo no contiene filas con datos para validar.'
                    },
                    formData,
                    resumen
                });
            }

            registrarBitacora(
                req,
                `Validacion preliminar de carga masiva ${req.file.originalname} para campania ${campania.id_campania}`
            );

            return renderCatalogoCargaMasiva(res, {
                pageMessage: {
                    tipo: resumen.filasConError > 0 ? 'warning' : 'success',
                    texto: resumen.filasConError > 0
                        ? 'Se proceso el archivo y se detectaron filas con error. Revisa el resumen antes de habilitar la carga real.'
                        : 'Archivo validado correctamente. Este primer corte solo muestra el resumen preliminar; aun no inserta productos.'
                },
                formData,
                resumen
            });
        } catch (error) {
            console.error(error);
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
