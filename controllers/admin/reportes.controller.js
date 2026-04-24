const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const campaniaModel = require('../../models/campania.model');
const cuentaModel = require('../../models/cuenta.model');
const reservaModel = require('../../models/reserva.model');
const usuarioModel = require('../../models/usuario.model');
const logger = require('../../utils/logger');
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
            logger.error(errCuentas);
            return res.status(500).send('No fue posible cargar las cuentas para el reporte.');
        }

        campaniaModel.obtenerTodas((errCampanias, campanias) => {
            if (errCampanias) {
                logger.error(errCampanias);
                return res.status(500).send('No fue posible cargar las campanas para el reporte.');
            }

            usuarioModel.obtenerConcesionariosConReservasConfirmadas((errUsuarios, concesionarios) => {
                if (errUsuarios) {
                    logger.error(errUsuarios);
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

async function generarXlsx(registros, metadatos = {}) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PPG Preventa';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Preventas', {
        views: [{ state: 'frozen', ySplit: 5 }]
    });

    sheet.columns = [
        { key: 'folio',         width: 14 },
        { key: 'cuenta',        width: 28 },
        { key: 'distribuidor',  width: 28 },
        { key: 'fecha_reserva', width: 16 },
        { key: 'estatus',       width: 14 },
        { key: 'subtotal',      width: 14 },
        { key: 'iva',           width: 12 },
        { key: 'total',         width: 14 },
        { key: 'peso_total',    width: 14 },
        { key: 'volumen_total', width: 16 },
        { key: 'campania',      width: 24 }
    ];

    const totalCols = sheet.columns.length;

    const estiloCeldaMeta = { font: { size: 10, color: { argb: 'FF64748B' } } };

    const fila1 = sheet.addRow(['Reporte Consolidado de Preventas — PPG']);
    sheet.mergeCells(`A1:K1`);
    fila1.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF1E3A5F' } };
    fila1.height = 24;

    const fila2 = sheet.addRow([`Período: ${metadatos.fechaInicio || ''} — ${metadatos.fechaFin || ''}`]);
    sheet.mergeCells(`A2:K2`);
    fila2.getCell(1).style = estiloCeldaMeta;

    const fila3 = sheet.addRow([`Tipo: ${metadatos.tipoReporte || 'General'}${metadatos.filtro ? '  |  Filtro: ' + metadatos.filtro : ''}`]);
    sheet.mergeCells(`A3:K3`);
    fila3.getCell(1).style = estiloCeldaMeta;

    const fila4 = sheet.addRow([`Generado: ${new Date().toLocaleString('es-MX')}`]);
    sheet.mergeCells(`A4:K4`);
    fila4.getCell(1).style = estiloCeldaMeta;
    fila4.height = 20;

    const encabezados = ['Folio', 'Cuenta', 'Distribuidor', 'Fecha de reserva', 'Estatus',
        'Subtotal ($)', 'IVA ($)', 'Total ($)', 'Peso total (kg)', 'Volumen total (L)', 'Campaña'];
    const filaEncabezado = sheet.addRow(encabezados);
    filaEncabezado.height = 20;
    filaEncabezado.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            bottom: { style: 'medium', color: { argb: 'FF2563EB' } }
        };
    });

    const estiloMoneda = { numFmt: '"$"#,##0.00' };
    const estiloDecimal = { numFmt: '#,##0.00' };

    registros.forEach((registro, idx) => {
        const fila = sheet.addRow([
            registro.folio,
            registro.cuenta,
            registro.distribuidor,
            registro.fecha_reserva,
            registro.estatus,
            Number(registro.subtotal),
            Number(registro.iva),
            Number(registro.total),
            Number(registro.peso_total),
            Number(registro.volumen_total),
            registro.campania
        ]);

        const bgColor = idx % 2 === 0 ? 'FFFAFAFA' : 'FFF1F5F9';
        fila.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
            cell.alignment = { vertical: 'middle' };
        });

        fila.getCell(6).numFmt = estiloMoneda.numFmt;
        fila.getCell(7).numFmt = estiloMoneda.numFmt;
        fila.getCell(8).numFmt = estiloMoneda.numFmt;
        fila.getCell(9).numFmt = estiloDecimal.numFmt;
        fila.getCell(10).numFmt = estiloDecimal.numFmt;
    });

    const ultimaFila = sheet.rowCount + 1;
    const filaTotales = sheet.addRow([
        'TOTAL', '', '', '', `${registros.length} reservas`,
        { formula: `SUM(F6:F${ultimaFila - 1})` },
        { formula: `SUM(G6:G${ultimaFila - 1})` },
        { formula: `SUM(H6:H${ultimaFila - 1})` },
        { formula: `SUM(I6:I${ultimaFila - 1})` },
        { formula: `SUM(J6:J${ultimaFila - 1})` },
        ''
    ]);
    filaTotales.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    });
    [6, 7, 8].forEach((col) => { filaTotales.getCell(col).numFmt = '"$"#,##0.00'; });
    [9, 10].forEach((col) => { filaTotales.getCell(col).numFmt = '#,##0.00'; });

    return workbook.xlsx.writeBuffer();
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
                logger.error(err);
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

            const metadatos = {
                fechaInicio: formData.fecha_inicio,
                fechaFin: formData.fecha_fin,
                tipoReporte: formData.tipo_reporte === 'general' ? 'General'
                    : formData.tipo_reporte === 'cuenta' ? 'Por cuenta'
                    : 'Por concesionario',
                filtro: idCuenta || correoConcesionario || null
            };

            generarXlsx(registros, metadatos).then((archivoXlsx) => {
                res.setHeader(
                    'Content-Type',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                );
                res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
                return res.send(archivoXlsx);
            }).catch((errXlsx) => {
                logger.error(errXlsx);
                return renderReportes(res, {
                    pageMessage: { tipo: 'danger', texto: 'No fue posible generar el archivo Excel.' },
                    formData
                });
            });
            return;
        }
    );
};
