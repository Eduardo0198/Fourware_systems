const ExcelJS = require('exceljs');
const { bitacoraModel, registrarEvento } = require('./shared');
const renderError = require('../../utils/renderError');

const AZUL_OSCURO  = 'FF1A3A5C';
const AZUL_MEDIO   = 'FF2E6DA4';
const GRIS_FILA    = 'FFF0F4F8';
const BLANCO       = 'FFFFFFFF';

function formatoFecha() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
}

exports.exportarBitacora = async (req, res) => {
    const usuario  = req.session.usuario;
    const correo   = String(req.query.usuario      || '').trim();
    const fechaInicio = String(req.query.fecha_inicio || '').trim();
    const fechaFin    = String(req.query.fecha_fin    || '').trim();
    const filtros  = { correo, fechaInicio, fechaFin };

    let registros;
    try {
        registros = await new Promise((resolve, reject) =>
            bitacoraModel.obtenerRegistrosFiltrados(filtros, (err, rows) =>
                err ? reject(err) : resolve(rows)
            )
        );
    } catch {
        return renderError(res, 500, 'Error al obtener registros para exportar.', '/admin/auditoria');
    }

    registrarEvento(req, 'Exportación de bitácora de auditoría', usuario?.correo);

    const wb   = new ExcelJS.Workbook();
    wb.creator = 'PPG Preventa';

    const ws = wb.addWorksheet('Bitácora');

    ws.mergeCells('A1:E1');
    const titulo = ws.getCell('A1');
    titulo.value     = 'Bitácora de Auditoría — PPG Preventa';
    titulo.font      = { bold: true, size: 14, color: { argb: BLANCO } };
    titulo.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_OSCURO } };
    titulo.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 30;

    ws.mergeCells('A2:E2');
    const subtitulo = ws.getCell('A2');
    const partes = [];
    if (fechaInicio) partes.push(`Desde: ${fechaInicio}`);
    if (fechaFin)    partes.push(`Hasta: ${fechaFin}`);
    if (correo)      partes.push(`Usuario: ${correo}`);
    if (!partes.length) partes.push('Sin filtros aplicados');
    subtitulo.value     = partes.join('   |   ');
    subtitulo.font      = { italic: true, size: 10, color: { argb: BLANCO } };
    subtitulo.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_MEDIO } };
    subtitulo.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 20;

    ws.columns = [
        { width: 10 },
        { width: 22 },
        { width: 32 },
        { width: 55 },
        { width: 22 }
    ];

    const rowEnc = ws.addRow(['ID', 'Fecha', 'Usuario', 'Acción', 'IP de origen']);
    rowEnc.eachCell(cell => {
        cell.font      = { bold: true, color: { argb: BLANCO } };
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_OSCURO } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border    = { bottom: { style: 'medium', color: { argb: AZUL_MEDIO } } };
    });
    rowEnc.height = 22;

    ws.views = [{ state: 'frozen', ySplit: 3 }];

    registros.forEach((r, idx) => {
        const ip = !r.ip_origen ? 'N/D'
            : String(r.ip_origen) === '::1' ? '127.0.0.1 (localhost)'
            : r.ip_origen;

        const fila = ws.addRow([r.id_log, r.fecha, r.correo || 'N/D', r.accion, ip]);
        const fondo = idx % 2 === 0 ? BLANCO : GRIS_FILA;
        fila.eachCell(cell => {
            cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: fondo } };
            cell.alignment = { vertical: 'middle', wrapText: false };
            cell.border    = { bottom: { style: 'hair', color: { argb: 'FFD0DCE8' } } };
        });
        fila.height = 18;
    });

    const totalRow = ws.addRow(['', '', '', `Total: ${registros.length} registros`, '']);
    totalRow.getCell(4).font      = { bold: true, color: { argb: BLANCO } };
    totalRow.getCell(4).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_MEDIO } };
    totalRow.getCell(4).alignment = { horizontal: 'center' };
    totalRow.height = 20;

    const nombre = `bitacora_${formatoFecha()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    await wb.xlsx.write(res);
    res.end();
};

exports.auditoria = (req, res) => {
    const esAjax = req.headers['x-requested-with'] === 'XMLHttpRequest';
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
        if (esAjax) {
            return res.json({
                ok: !datosExtra.estadoConsulta?.startsWith('error'),
                registros:       datosExtra.registros       || [],
                totalRegistros:  datosExtra.totalRegistros  || 0,
                mensaje:         datosExtra.mensaje         || null
            });
        }
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
                    'Error al consultar bitacora de auditoria',
                    usuario ? usuario.correo : null
                );

                return renderAuditoria({
                    estadoConsulta: 'error-consulta',
                    mensaje: {
                        tipo: 'danger',
                        texto: 'No fue posible cargar la bitacora de auditoria. Intente nuevamente.'
                    }
                });
            }

            registrarEvento(req, 'Consulta de bitacora de auditoria', usuario ? usuario.correo : null);

            return renderAuditoria({
                registros,
                totalRegistros: registros.length,
                estadoConsulta: registros.length > 0 ? 'con-resultados' : 'sin-resultados',
                mensaje: registros.length > 0
                    ? {
                        tipo: 'info',
                        texto: 'Se muestran los registros mas recientes de la bitacora.'
                    }
                    : {
                        tipo: 'info',
                        texto: 'No hay registros disponibles en la bitacora.'
                    }
            });
        });
    }

    if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
        return renderAuditoria({
            estadoConsulta: 'error-validacion',
            mensaje: {
                tipo: 'warning',
                texto: 'El rango de fechas ingresado no es valido.'
            }
        });
    }

    bitacoraModel.obtenerRegistrosFiltrados(filtros, (err, registros) => {
        if (err) {
            registrarEvento(
                req,
                'Error al consultar bitacora de auditoria',
                usuario ? usuario.correo : null
            );

            return renderAuditoria({
                estadoConsulta: 'error-consulta',
                mensaje: {
                    tipo: 'danger',
                    texto: 'No fue posible consultar la bitacora de auditoria. Intente nuevamente.'
                }
            });
        }

        const totalRegistros = registros.length;
        const accionConsulta = totalRegistros > 0
            ? 'Consulta de bitacora de auditoria'
            : 'Consulta de bitacora de auditoria sin resultados';

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
