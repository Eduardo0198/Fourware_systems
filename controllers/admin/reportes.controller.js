const XLSX = require('xlsx');
const campaniaModel = require('../../models/campania.model');
const cuentaModel = require('../../models/cuenta.model');
const reservaModel = require('../../models/reserva.model');
const usuarioModel = require('../../models/usuario.model');
const {
    esFechaValida,
    normalizarCampania,
    registrarBitacora,
    registrarEvento
} = require('./shared');

const FORMATOS_REPORTE = new Set(['csv', 'xlsx']);

function formatearFecha(valor) {
    const fecha = new Date(valor);

    if (Number.isNaN(fecha.getTime())) {
        return '';
    }

    return fecha.toISOString().slice(0, 10);
}

function formatearDecimal(valor) {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero.toFixed(2) : '0.00';
}

function normalizarReservasReporte(reservas) {
    return (Array.isArray(reservas) ? reservas : []).map((reserva) => ({
        folio: reserva.folio,
        cuenta: reserva.cuenta || '',
        distribuidor: reserva.distribuidor || '',
        fecha_reserva: formatearFecha(reserva.fecha),
        estatus: Number(reserva.estatus) === 1 ? 'Confirmada' : 'Sin definir',
        subtotal: formatearDecimal(reserva.subtotal),
        iva: formatearDecimal(reserva.iva),
        total: formatearDecimal(reserva.total),
        peso_total: formatearDecimal(reserva.peso_total),
        volumen_total: formatearDecimal(reserva.volumen_total),
        campania: reserva.campanias || ''
    }));
}

function renderReportes(res, options = {}) {
    cuentaModel.obtenerTodas((errCuentas, cuentas) => {
        if (errCuentas) {
            console.error(errCuentas);
            return res.status(500).send('No fue posible cargar las cuentas para el reporte.');
        }

        campaniaModel.obtenerTodas((errCampanias, campanias) => {
            if (errCampanias) {
                console.error(errCampanias);
                return res.status(500).send('No fue posible cargar las campanas para el reporte.');
            }

            usuarioModel.obtenerConcesionariosConReservasConfirmadas((errUsuarios, concesionarios) => {
                if (errUsuarios) {
                    console.error(errUsuarios);
                    return res.status(500).send('No fue posible cargar los concesionarios para el reporte.');
                }

                res.render('modules/adminReportes', {
                    pageMessage: options.pageMessage || res.locals.mensaje || null,
                    formData: {
                        tipo_reporte: 'general',
                        ...options.formData
                    },
                    totalResultados: options.totalResultados || 0,
                    cuentas,
                    campanias: campanias.map(normalizarCampania),
                    concesionarios
                });
            });
        });
    });
}

function construirNombreArchivo(fechaInicio, fechaFin, formato, tipoReporte, filtroValor, idCampania) {
    const segmentos = [
        'reporte_preventas',
        fechaInicio,
        fechaFin,
        tipoReporte
    ];

    if (filtroValor) {
        segmentos.push(
            tipoReporte === 'cuenta'
                ? `cuenta-${filtroValor}`
                : `concesionario-${String(filtroValor).replace(/[^a-zA-Z0-9_-]/g, '-')}`
        );
    }

    if (idCampania) {
        segmentos.push(`campana-${idCampania}`);
    }

    return `${segmentos.join('_')}.${formato}`;
}

function construirFilasExportacion(registros) {
    return registros.map((registro) => ({
        Folio: registro.folio,
        Cuenta: registro.cuenta,
        Distribuidor: registro.distribuidor,
        'Fecha de reserva': registro.fecha_reserva,
        Estatus: registro.estatus,
        Subtotal: registro.subtotal,
        IVA: registro.iva,
        Total: registro.total,
        'Peso total': registro.peso_total,
        'Volumen total': registro.volumen_total,
        Campana: registro.campania
    }));
}

function escaparCsv(valor) {
    const texto = String(valor ?? '');
    return `"${texto.replace(/"/g, '""')}"`;
}

function generarCsv(registros) {
    const filas = construirFilasExportacion(registros);

    if (!filas.length) {
        return '';
    }

    const encabezados = Object.keys(filas[0]);
    const lineas = [
        encabezados.map(escaparCsv).join(',')
    ];

    filas.forEach((fila) => {
        lineas.push(encabezados.map((encabezado) => escaparCsv(fila[encabezado])).join(','));
    });

    return lineas.join('\n');
}

function generarXlsx(registros) {
    const filas = construirFilasExportacion(registros);
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(filas);

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Preventas');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

exports.reportes = (req, res) => {
    registrarEvento(req, 'Consulta de reportes administrativos');
    renderReportes(res);
};

exports.reportesPost = (req, res) => {
    const formData = {
        fecha_inicio: String(req.body.fecha_inicio || '').trim(),
        fecha_fin: String(req.body.fecha_fin || '').trim(),
        formato: String(req.body.formato || '').trim().toLowerCase(),
        id_campania: String(req.body.id_campania || '').trim(),
        tipo_reporte: String(req.body.tipo_reporte || '').trim().toLowerCase(),
        id_cuenta: String(req.body.id_cuenta || '').trim(),
        correo_concesionario: String(req.body.correo_concesionario || '').trim()
    };

    if (!formData.fecha_inicio || !formData.fecha_fin || !formData.formato || !formData.tipo_reporte) {
        return renderReportes(res, {
            pageMessage: {
                tipo: 'danger',
                texto: 'Debes capturar fecha inicial, fecha final, tipo de reporte y formato.'
            },
            formData
        });
    }

    if (!esFechaValida(formData.fecha_inicio) || !esFechaValida(formData.fecha_fin)) {
        return renderReportes(res, {
            pageMessage: {
                tipo: 'danger',
                texto: 'Debes capturar un rango de fechas valido.'
            },
            formData
        });
    }

    if (formData.fecha_inicio > formData.fecha_fin) {
        return renderReportes(res, {
            pageMessage: {
                tipo: 'warning',
                texto: 'La fecha inicial no puede ser posterior a la fecha final.'
            },
            formData
        });
    }

    if (!FORMATOS_REPORTE.has(formData.formato)) {
        return renderReportes(res, {
            pageMessage: {
                tipo: 'danger',
                texto: 'El formato seleccionado no es valido.'
            },
            formData
        });
    }

    if (!['general', 'cuenta', 'concesionario'].includes(formData.tipo_reporte)) {
        return renderReportes(res, {
            pageMessage: {
                tipo: 'danger',
                texto: 'El tipo de reporte seleccionado no es valido.'
            },
            formData
        });
    }

    const idCampania = formData.id_campania ? parseInt(formData.id_campania, 10) : null;
    const idCuenta = formData.tipo_reporte === 'cuenta' && formData.id_cuenta
        ? parseInt(formData.id_cuenta, 10)
        : null;
    const correoConcesionario = formData.tipo_reporte === 'concesionario'
        ? formData.correo_concesionario
        : null;

    if (formData.tipo_reporte === 'cuenta' && !formData.id_cuenta) {
        return renderReportes(res, {
            pageMessage: {
                tipo: 'warning',
                texto: 'Debes seleccionar una cuenta para el reporte por cuenta.'
            },
            formData
        });
    }

    if (formData.tipo_reporte === 'concesionario' && !formData.correo_concesionario) {
        return renderReportes(res, {
            pageMessage: {
                tipo: 'warning',
                texto: 'Debes seleccionar un concesionario para ese tipo de reporte.'
            },
            formData
        });
    }

    if (formData.tipo_reporte === 'cuenta' && Number.isNaN(idCuenta)) {
        return renderReportes(res, {
            pageMessage: {
                tipo: 'danger',
                texto: 'La cuenta seleccionada no es valida.'
            },
            formData
        });
    }

    if (formData.id_campania && Number.isNaN(idCampania)) {
        return renderReportes(res, {
            pageMessage: {
                tipo: 'danger',
                texto: 'La campana seleccionada no es valida.'
            },
            formData
        });
    }

    reservaModel.obtenerReservasConfirmadasConFiltros(
        {
            fechaInicio: formData.fecha_inicio,
            fechaFin: formData.fecha_fin,
            idCuenta,
            correo: correoConcesionario,
            idCampania
        },
        (err, reservas) => {
            if (err) {
                console.error(err);
                registrarBitacora(
                    req,
                    `Error al generar reporte consolidado de preventas del ${formData.fecha_inicio} al ${formData.fecha_fin}`
                );
                return renderReportes(res, {
                    pageMessage: {
                        tipo: 'danger',
                        texto: 'No fue posible generar el reporte consolidado de preventas.'
                    },
                    formData
                });
            }

            const registros = normalizarReservasReporte(reservas);

            if (!registros.length) {
                registrarBitacora(
                    req,
                    `Consulta de reporte consolidado sin resultados del ${formData.fecha_inicio} al ${formData.fecha_fin}`
                );
                return renderReportes(res, {
                    pageMessage: {
                        tipo: 'info',
                        texto: 'No existen preventas confirmadas con el rango de fechas seleccionado.'
                    },
                    formData
                });
            }

            const nombreArchivo = construirNombreArchivo(
                formData.fecha_inicio,
                formData.fecha_fin,
                formData.formato,
                formData.tipo_reporte,
                idCuenta || correoConcesionario,
                idCampania
            );

            registrarBitacora(
                req,
                `Generacion de reporte consolidado de ${registros.length} preventa(s) en formato ${formData.formato}`
            );

            if (formData.formato === 'csv') {
                const csv = generarCsv(registros);
                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
                return res.send('\uFEFF' + csv);
            }

            const archivoXlsx = generarXlsx(registros);
            res.setHeader(
                'Content-Type',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            );
            res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
            return res.send(archivoXlsx);
        }
    );
};
