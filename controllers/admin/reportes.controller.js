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
    const abreviarFecha = (f) => {
        const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
        const [anio, mes, dia] = f.split('-');
        return `${dia}${meses[parseInt(mes, 10) - 1]}${anio.slice(2)}`;
    };

    const tipo = tipoReporte === 'general' ? 'gral'
        : tipoReporte === 'cuenta' ? 'cta'
        : 'con';

    const segmentos = ['PPG_preventas', tipo, abreviarFecha(fechaInicio)];

    if (fechaFin !== fechaInicio) segmentos.push(abreviarFecha(fechaFin));
    if (idCampania) segmentos.push(`c${idCampania}`);

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
        views: [{ state: 'frozen', ySplit: 6 }]
    });

    const claves = ['folio', 'cuenta', 'distribuidor', 'fecha_reserva', 'estatus',
        'subtotal', 'iva', 'total', 'peso_total', 'volumen_total', 'campania'];
    const encabezados = ['Folio', 'Cuenta', 'Distribuidor', 'Fecha de reserva', 'Estatus',
        'Subtotal ($)', 'IVA ($)', 'Total ($)', 'Peso total (kg)', 'Volumen total (L)', 'Campaña'];

    const anchos = encabezados.map((h) => h.length + 2);
    registros.forEach((r) => {
        claves.forEach((k, i) => {
            const len = String(r[k] ?? '').length;
            if (len > anchos[i]) anchos[i] = len;
        });
    });
    sheet.columns = claves.map((key, i) => ({
        key,
        width: Math.min(Math.max(anchos[i] + 4, 12), 52)
    }));

    const LAST_COL = 'K';
    const AZUL_OSCURO = 'FF1E3A5F';
    const AZUL_ACENTO = 'FF2563EB';
    const FONDO_META  = 'FFE8EFF8';
    const FMT_MONEDA  = '"$"#,##0.00';
    const FMT_DECIMAL = '#,##0.00';

    // ── Fila 1: Título ──────────────────────────────────────────────────────
    const fila1 = sheet.addRow(['Reporte Consolidado de Preventas  ·  PPG']);
    sheet.mergeCells(`A1:${LAST_COL}1`);
    const c1 = fila1.getCell(1);
    c1.font      = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } };
    c1.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_OSCURO } };
    c1.alignment = { vertical: 'middle', horizontal: 'left', indent: 2 };
    fila1.height = 34;

    // ── Filas 2-4: Metadatos ─────────────────────────────────────────────────
    const datosMeta = [
        `Período:    ${metadatos.fechaInicio || ''}  →  ${metadatos.fechaFin || ''}`,
        `Tipo:       ${metadatos.tipoReporte || 'General'}${metadatos.filtro ? '     |     Filtro: ' + metadatos.filtro : ''}`,
        `Generado:   ${new Date().toLocaleString('es-MX')}`
    ];
    datosMeta.forEach((texto, idx) => {
        const num = idx + 2;
        const fila = sheet.addRow([texto]);
        sheet.mergeCells(`A${num}:${LAST_COL}${num}`);
        const c = fila.getCell(1);
        c.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: FONDO_META } };
        c.font      = { size: 10, color: { argb: AZUL_OSCURO }, italic: idx === 2 };
        c.alignment = { vertical: 'middle', horizontal: 'left', indent: 2 };
        fila.height = 17;
    });

    // ── Fila 5: Separador azul ───────────────────────────────────────────────
    const filaSep = sheet.addRow(['']);
    sheet.mergeCells(`A5:${LAST_COL}5`);
    filaSep.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_ACENTO } };
    filaSep.height = 5;

    // ── Fila 6: Encabezados de columna ──────────────────────────────────────
    const filaEnc = sheet.addRow(encabezados);
    filaEnc.height = 22;
    filaEnc.eachCell({ includeEmpty: true }, (cell) => {
        cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_OSCURO } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border    = { bottom: { style: 'medium', color: { argb: AZUL_ACENTO } } };
    });

    // ── Filas de datos ───────────────────────────────────────────────────────
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
        const bg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF1F5F9';
        fila.eachCell({ includeEmpty: true }, (cell) => {
            cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
            cell.alignment = { vertical: 'middle' };
        });
        fila.getCell(6).numFmt = FMT_MONEDA;
        fila.getCell(7).numFmt = FMT_MONEDA;
        fila.getCell(8).numFmt = FMT_MONEDA;
        fila.getCell(9).numFmt = FMT_DECIMAL;
        fila.getCell(10).numFmt = FMT_DECIMAL;
    });

    // ── Fila de totales ──────────────────────────────────────────────────────
    const primerDato  = 7;
    const ultimoDato  = 6 + registros.length;
    const filaTotales = sheet.addRow([
        'TOTALES', '', '', '', `${registros.length} reserva(s)`,
        { formula: `SUM(F${primerDato}:F${ultimoDato})` },
        { formula: `SUM(G${primerDato}:G${ultimoDato})` },
        { formula: `SUM(H${primerDato}:H${ultimoDato})` },
        { formula: `SUM(I${primerDato}:I${ultimoDato})` },
        { formula: `SUM(J${primerDato}:J${ultimoDato})` },
        ''
    ]);
    filaTotales.height = 20;
    filaTotales.eachCell({ includeEmpty: true }, (cell) => {
        cell.font  = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_OSCURO } };
        cell.alignment = { vertical: 'middle' };
    });
    [6, 7, 8].forEach((col) => { filaTotales.getCell(col).numFmt = FMT_MONEDA; });
    [9, 10].forEach((col) => { filaTotales.getCell(col).numFmt = FMT_DECIMAL; });

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
