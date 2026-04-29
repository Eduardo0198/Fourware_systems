const util = require('util');
const metricasModel = require('../models/metricas.model');
const campaniaModel = require('../models/campania.model');
const reservaModel = require('../models/reserva.model');
const concesionarioModel = require('../models/concesionario.model');
const ExcelJS = require('exceljs');
const { registrarEvento } = require('../utils/auditoria.helper');
const logger = require('../utils/logger');
const calificacionModel = require('../models/calificacion.model');
const { obtenerDatosCatalogo } = require('./concesionario/shared');
const renderError = require('../utils/renderError');

const obtenerCampaniaActivaAsync = util.promisify(campaniaModel.obtenerCampaniaActiva);

const CRITERIO_NOMBRE_VALIDO = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9][A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s.,-]*$/;

function obtenerPercepcionGeneral(promedio, totalCalificaciones) {
  if (!totalCalificaciones) return 'Sin opiniones';
  if (promedio >= 4) return 'Percepción positiva';
  if (promedio >= 3) return 'Percepción neutra';
  return 'Área de mejora';
}

function esPeticionAjax(req) {
  return req.get('X-Requested-With') === 'XMLHttpRequest';
}

function normalizarResultadosConsulta(rows) {
  return (rows || []).map((item) => {
    const totalCalificaciones = Number(item.total_calificaciones || 0);
    const promedioEstrellas = Number(item.promedio_estrellas || 0);
    return {
      ...item,
      total_calificaciones: totalCalificaciones,
      total_comentarios: Number(item.total_comentarios || 0),
      promedio_estrellas: promedioEstrellas,
      comentarios: Array.isArray(item.comentarios) ? item.comentarios : [],
      percepcion_general: obtenerPercepcionGeneral(promedioEstrellas, totalCalificaciones)
    };
  });
}

function responderBusqueda(req, res, payload) {
  if (esPeticionAjax(req)) {
    return res.json(payload);
  }
  return renderRankingProductos(res, payload);
}

function normalizarRankingProductos(rows) {
  return (rows || []).map((item) => {
    const promedio = Number(item.promedio_estrellas || 0);
    const nombre = String(item.nombre_comercial || '');
    return {
      ...item,
      promedio_estrellas: promedio,
      total_calificaciones: Number(item.total_calificaciones || 0),
      altura: Math.max(24, Math.round((promedio / 5) * 220)),
      etiqueta: nombre.length > 14 ? `${nombre.slice(0, 14)}...` : nombre
    };
  });
}

function renderRankingProductos(res, payload) {
  calificacionModel.obtenerPromedioCalificacionesPorCampaniaActiva((err, graficaCampanias) => {
    const datos = (graficaCampanias || []).map((item) => {
      const promedio = Number(item.promedio_estrellas || 0);
      return {
        ...item,
        promedio_estrellas: promedio,
        total_calificaciones: Number(item.total_calificaciones || 0),
        porcentaje: Math.min(100, Math.round((promedio / 5) * 100))
      };
    });

    if (err) {
      logger.error(err);
    }

    calificacionModel.obtenerRankingProductosPorCalificacion('DESC', 20, 5, (errMejores, mejores) => {
      if (errMejores) {
        logger.error(errMejores);
      }

      calificacionModel.obtenerRankingProductosPorCalificacion('ASC', 20, (errPeores, peores) => {
        if (errPeores) {
          logger.error(errPeores);
        }

        const pageMessage = payload.pageMessage || ((err || errMejores || errPeores) ? {
          tipo: 'warning',
          texto: 'No fue posible cargar una o más gráficas del módulo.'
        } : null);

        return res.render('marketing/rankingProductos', {
          ...payload,
          pageMessage,
          graficaCampanias: err ? [] : datos,
          graficaMejoresProductos: errMejores ? [] : normalizarRankingProductos(mejores),
          graficaPeoresProductos: errPeores ? [] : normalizarRankingProductos(peores)
        });
      });
    });
  });
}

const REGIONES_FIJAS = ['Bajio', 'Centro', 'Centronorte', 'Centrosur', 'Noreste', 'Noroeste', 'Norte', 'Occidente', 'Oriente', 'Sur', 'Suroeste', 'Sureste'];

function procesarGeografico(rows) {
    const byEstado = {};
    const totalesPorProducto = {};
    const infoProducto = {};
    const totalesPorEstado = {};

    REGIONES_FIJAS.forEach(r => { byEstado[r] = {}; totalesPorEstado[r] = 0; });

    (rows || []).forEach(r => {
        const region = r.region || 'Sin región';
        const sku = r.SKU;
        const unidades = Number(r.cantidad || 0);
        if (!byEstado[region]) byEstado[region] = {};
        byEstado[region][sku] = (byEstado[region][sku] || 0) + unidades;
        totalesPorProducto[sku] = (totalesPorProducto[sku] || 0) + unidades;
        totalesPorEstado[region] = (totalesPorEstado[region] || 0) + unidades;
        if (!infoProducto[sku]) infoProducto[sku] = r.nombre_comercial;
    });

    const topProductos = Object.entries(totalesPorProducto)
        .sort((a, b) => b[1] - a[1]).slice(0, 7)
        .map(([sku]) => ({ sku, nombre: infoProducto[sku] || sku }));

    const estados = Object.keys(byEstado).sort();
    let maxVal = 1;
    estados.forEach(e => topProductos.forEach(p => {
        const v = byEstado[e][p.sku] || 0;
        if (v > maxVal) maxVal = v;
    }));

    return { estados, productos: topProductos, matrix: byEstado, maxVal, totalesPorEstado };
}

function renderMetricasRanking(res, opts = {}) {
    let resultados = opts.resultados || null;
    if (resultados && !resultados.geografico) {
        resultados = { ...resultados, geografico: procesarGeografico([]) };
    }
    return res.render('marketing/metricasRanking', {
        campanias:        opts.campanias        || [],
        sinCampanias:     opts.sinCampanias     || false,
        resultados,
        filtros:          opts.filtros          || {},
        campaniaActivaId: opts.campaniaActivaId || null,
        pageMessage:      opts.pageMessage      || null
    });
}

exports.inicio = (req, res) => {
    registrarEvento(req, 'Consulta de inicio de marketing');

    const usuario = req.session.usuario;
    let resumen = { total: 0, confirmadas: 0, canceladas: 0 };
    let campania = null;
    let topProductos = [];
    let pendientes = 3;

    function intentarRender() {
        pendientes -= 1;
        if (pendientes > 0) return;
        res.render('marketing/inicio', {
            saludo: usuario.nombre.split(' ')[0],
            resumen,
            campania,
            topProductos: topProductos.slice(0, 3)
        });
    }

    reservaModel.obtenerResumenAdministrativo((err, rows) => {
        if (!err && rows && rows[0]) {
            resumen = {
                total:       Number(rows[0].total       || 0),
                confirmadas: Number(rows[0].confirmadas || 0),
                canceladas:  Number(rows[0].canceladas  || 0)
            };
        } else if (err) logger.error(err);
        intentarRender();
    });

    campaniaModel.obtenerCampaniaActiva((err, rows) => {
        if (!err && rows && rows.length > 0) campania = rows[0];
        else if (err) logger.error(err);
        intentarRender();
    });

    concesionarioModel.obtenerTopProductos((err, rows) => {
        if (!err && Array.isArray(rows)) topProductos = rows;
        else if (err) logger.error(err);
        intentarRender();
    });
};

exports.rankingProductos = (req, res) => {
  const nombre = String(req.query.nombre || '').trim();

  if (!nombre) {
    return responderBusqueda(req, res, {
      criterios: { nombre: '' },
      resultados: [],
      pageMessage: null
    });
  }

  if (!CRITERIO_NOMBRE_VALIDO.test(nombre)) {
    registrarEvento(req, 'Intento de consulta con criterios inválidos de calificaciones y comentarios');
    return responderBusqueda(req, res, {
      criterios: { nombre },
      resultados: [],
      pageMessage: {
        tipo: 'warning',
        texto: 'Debe seleccionar criterios de consulta válidos.'
      }
    });
  }

  calificacionModel.consultarResultadosMarketingPorNombre(nombre, (err, resultados) => {
    if (err) {
      logger.error(err);
      registrarEvento(req, 'Error al procesar consulta de calificaciones y comentarios de productos');
      return responderBusqueda(req, res, {
        criterios: { nombre },
        resultados: [],
        pageMessage: {
          tipo: 'danger',
          texto: 'Error al procesar información.'
        }
      });
    }

    const resultadosNormalizados = normalizarResultadosConsulta(resultados);

    if (!resultadosNormalizados.length) {
      registrarEvento(req, 'Consulta sin resultados de calificaciones y comentarios de productos');
      return responderBusqueda(req, res, {
        criterios: { nombre },
        resultados: [],
        pageMessage: {
          tipo: 'warning',
          texto: 'No existen calificaciones ni comentarios registrados para los criterios seleccionados.'
        }
      });
    }

    registrarEvento(req, 'Consulta de resultados de calificaciones y comentarios de productos');
    return responderBusqueda(req, res, {
      criterios: { nombre },
      resultados: resultadosNormalizados,
      pageMessage: null
    });
  });
};

exports.metricasRanking = async (req, res) => {
    try {
        const campanias = await metricasModel.obtenerCampaniasConReservas();

        if (!campanias || campanias.length === 0) {
            registrarEvento(req, 'Consulta de métricas sin campañas con reservas activas');
            return renderMetricasRanking(res, {
                sinCampanias: true,
                pageMessage: { tipo: 'warning', texto: 'No hay campañas con reservas registradas.' }
            });
        }

        const activas = await obtenerCampaniaActivaAsync();
        const campaniaActiva = Array.isArray(activas) && activas.length > 0 ? activas[0] : null;
        const campaniaActivaId = campaniaActiva ? campaniaActiva.id_campania : null;

        if (!campaniaActivaId) {
            registrarEvento(req, 'Acceso a consulta de ranking sin campaña activa');
            return renderMetricasRanking(res, { campanias });
        }

        const filtros = { idCampania: campaniaActivaId, fechaInicio: null, fechaFin: null, producto: null };

        const { ranking, metricas, geografico } = await metricasModel.consultarDatos(filtros);

        registrarEvento(req, 'Acceso a consulta de ranking de productos y métricas comparativas');
        return renderMetricasRanking(res, {
            campanias,
            resultados: { ranking, metricas, geografico: procesarGeografico(geografico) },
            filtros: { idCampania: campaniaActivaId },
            campaniaActivaId
        });
    } catch (err) {
        logger.error(err);
        registrarEvento(req, 'Error al cargar campañas para métricas de ranking');
        return renderMetricasRanking(res, {
            sinCampanias: true,
            pageMessage: { tipo: 'danger', texto: 'Error al cargar las campañas.' }
        });
    }
};

exports.consultarMetricas = async (req, res) => {
    const { idCampania, fechaInicio, fechaFin, producto, tabActivo } = req.body;
    const filtros = { idCampania, fechaInicio, fechaFin, producto, tabActivo };

    if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
        try {
            const campanias = await metricasModel.obtenerCampaniasConReservas();
            return renderMetricasRanking(res, {
                campanias,
                filtros,
                pageMessage: { tipo: 'danger', texto: 'La fecha de fin no puede ser anterior a la fecha de inicio.' }
            });
        } catch (_) {
            return renderMetricasRanking(res, {
                filtros,
                pageMessage: { tipo: 'danger', texto: 'La fecha de fin no puede ser anterior a la fecha de inicio.' }
            });
        }
    }

    try {
        const [campanias, { ranking, metricas, geografico }] = await Promise.all([
            metricasModel.obtenerCampaniasConReservas(),
            metricasModel.consultarDatos(filtros)
        ]);

        registrarEvento(req, 'Consulta de ranking de productos y métricas comparativas por campaña');
        return renderMetricasRanking(res, {
            campanias,
            resultados: { ranking, metricas, geografico: procesarGeografico(geografico) },
            filtros,
            pageMessage: ranking && ranking.length === 0
                ? { tipo: 'info', texto: 'No se encontraron productos con los filtros aplicados.' }
                : null
        });
    } catch (err) {
        logger.error(err);
        registrarEvento(req, 'Error al consultar métricas o ranking');
        return renderMetricasRanking(res, {
            filtros,
            pageMessage: { tipo: 'danger', texto: 'Error al cargar los datos.' }
        });
    }
};


const AZUL        = 'FF1A3A5C';
const AZUL_MEDIO  = 'FF2E6DA4';
const BLANCO      = 'FFFFFFFF';
const GRIS_FILA   = 'FFF0F4F8';

function excelEncabezado(ws, nRow, columnas) {
    const fila = ws.getRow(nRow);
    fila.height = 26;
    columnas.forEach((txt, i) => {
        const c = fila.getCell(i + 1);
        c.value = txt;
        c.font  = { bold: true, color: { argb: BLANCO }, size: 11 };
        c.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
        c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });
}

function excelFila(ws, nRow, valores, formatos) {
    const fila = ws.getRow(nRow);
    fila.height = 18;
    const bg = nRow % 2 === 0 ? GRIS_FILA : BLANCO;
    valores.forEach((val, i) => {
        const c = fila.getCell(i + 1);
        c.value = val;
        c.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        c.alignment = { vertical: 'middle', horizontal: typeof val === 'number' ? 'right' : 'left' };
        c.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' } };
        if (formatos && formatos[i]) c.numFmt = formatos[i];
    });
}

function excelTitulo(ws, celda, hasta, texto) {
    ws.mergeCells(`${celda}:${hasta}`);
    const c = ws.getCell(celda);
    c.value = texto;
    c.font  = { bold: true, size: 13, color: { argb: BLANCO } };
    c.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 34;
}

exports.exportarMetricas = async (req, res) => {
    const { idCampania, fechaInicio, fechaFin, producto, chartRankingImg, chartMetricasImg } = req.body;
    const filtros = { idCampania, fechaInicio, fechaFin, producto };

    try {
        const { ranking, metricas } = await metricasModel.consultarDatos(filtros);

        const wb = new ExcelJS.Workbook();
        wb.creator = 'PPG Preventa';

        const fechaGen = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });

        const wsR = wb.addWorksheet('Ranking');
        wsR.columns = [
            { width: 9 }, { width: 14 }, { width: 36 },
            { width: 18 }, { width: 28 }, { width: 18 }, { width: 20 }
        ];
        excelTitulo(wsR, 'A1', 'G1', 'RANKING DE PRODUCTOS — PPG Preventa');
        wsR.mergeCells('A2:G2');
        Object.assign(wsR.getCell('A2'), {
            value: `Generado: ${fechaGen}`,
            font: { italic: true, size: 9, color: { argb: 'FF888888' } },
            alignment: { horizontal: 'right' }
        });
        excelEncabezado(wsR, 3, ['#', 'SKU', 'Producto', 'Unidades vendidas', 'Campaña', 'Órdenes campaña', 'Monto campaña']);
        wsR.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }];
        ranking.forEach((r, i) => excelFila(wsR, i + 4,
            [Number(r.posicion), r.SKU, r.nombre_comercial, Number(r.total_unidades),
             r.nombre_campania, Number(r.total_ordenes_campania), Number(r.monto_total_campania)],
            [null, null, null, '#,##0', null, '#,##0', '"$"#,##0.00']
        ));

        const wsM = wb.addWorksheet('Métricas');
        wsM.columns = [{ width: 32 }, { width: 18 }, { width: 22 }];
        excelTitulo(wsM, 'A1', 'C1', 'MÉTRICAS COMPARATIVAS POR CAMPAÑA');
        wsM.mergeCells('A2:C2');
        Object.assign(wsM.getCell('A2'), {
            value: `Generado: ${fechaGen}`,
            font: { italic: true, size: 9, color: { argb: 'FF888888' } },
            alignment: { horizontal: 'right' }
        });
        excelEncabezado(wsM, 3, ['Campaña', 'Total órdenes', 'Monto total']);
        wsM.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }];
        metricas.forEach((m, i) => excelFila(wsM, i + 4,
            [m.nombre_campania, Number(m.total_ordenes), Number(m.monto_total)],
            [null, '#,##0', '"$"#,##0.00']
        ));
        const nTotal = metricas.length + 4;
        const totOrd = metricas.reduce((s, m) => s + Number(m.total_ordenes), 0);
        const totMon = metricas.reduce((s, m) => s + Number(m.monto_total), 0);
        ['TOTAL', totOrd, totMon].forEach((val, i) => {
            const c = wsM.getRow(nTotal).getCell(i + 1);
            c.value = val;
            c.font  = { bold: true, color: { argb: BLANCO } };
            c.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_MEDIO } };
            c.alignment = { horizontal: i === 0 ? 'left' : 'right', vertical: 'middle' };
            if (i === 1) c.numFmt = '#,##0';
            if (i === 2) c.numFmt = '"$"#,##0.00';
        });
        wsM.getRow(nTotal).height = 22;

        if (chartRankingImg || chartMetricasImg) {
            const wsG = wb.addWorksheet('Gráficas');
            wsG.columns = Array(10).fill({ width: 12 });
            excelTitulo(wsG, 'A1', 'J1', 'GRÁFICAS DE ANÁLISIS');
            let rowOff = 2;
            for (const [img, label] of [[chartRankingImg, 'Top 10 productos por unidades vendidas'], [chartMetricasImg, 'Comparativa de campañas']]) {
                if (!img) continue;
                wsG.getCell(`A${rowOff}`).value = label;
                wsG.getCell(`A${rowOff}`).font  = { bold: true, size: 11, color: { argb: AZUL } };
                rowOff++;
                const imgId = wb.addImage({ base64: img.replace(/^data:image\/png;base64,/, ''), extension: 'png' });
                wsG.addImage(imgId, { tl: { col: 0, row: rowOff }, ext: { width: 680, height: 340 } });
                rowOff += 20;
            }
        }

        const d = new Date();
        const hoy = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
        const buffer = await wb.xlsx.writeBuffer();

        registrarEvento(req, 'Exportación de ranking de productos y métricas comparativas');
        res.setHeader('Content-Disposition', `attachment; filename="ranking_PPG_${hoy}.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        return res.send(buffer);
    } catch (err) {
        logger.error(err);
        registrarEvento(req, 'Error al exportar métricas');
        return res.status(500).json({ ok: false, mensaje: 'Error al exportar los datos.' });
    }
};


exports.catalogo = (req, res) => {
    obtenerDatosCatalogo(req, concesionarioModel, (err, data) => {
        if (err) {
            logger.error(err);
            registrarEvento(req, 'Error al consultar catálogo desde marketing');
            return renderError(res, 500, 'Error al obtener el catálogo.', '/marketing/inicio');
        }

        registrarEvento(req, 'Consulta de catálogo de productos desde marketing');
        return res.render('modules/concesionarioCatalogo', {
            ...data,
            mostrarBanner: false,
            soloLectura: true,
            pageMessage: null
        });
    });
};

exports.detalleProducto = (req, res) => {
    const sku = String(req.params.sku || '').trim().toUpperCase();

    concesionarioModel.obtenerProductoPorSku(sku, (err, producto) => {
        if (err) {
            logger.error(err);
            registrarEvento(req, 'Error al consultar detalle de producto desde marketing');
            return res.redirect('/marketing/catalogo');
        }

        if (!producto) {
            registrarEvento(req, `Intento de consulta de producto no disponible desde marketing: ${sku}`);
            return res.redirect('/marketing/catalogo');
        }

        calificacionModel.obtenerResumenCalificacionesPorSku(sku, (errResumen, resumenCalificaciones) => {
            if (errResumen) {
                logger.error(errResumen);
                return res.redirect('/marketing/catalogo');
            }

            calificacionModel.obtenerResenasPorSku(sku, (errResenas, resenas) => {
                if (errResenas) {
                    logger.error(errResenas);
                    return res.redirect('/marketing/catalogo');
                }

                const totalResenas = resumenCalificaciones.total_resenas || 0;
                const distribucionConPorcentaje = [5, 4, 3, 2, 1].map((estrella) => {
                    const total = resumenCalificaciones.distribucion[estrella] || 0;
                    return {
                        estrella,
                        total,
                        porcentaje: totalResenas > 0 ? Math.round((total / totalResenas) * 100) : 0
                    };
                });

                registrarEvento(req, `Consulta de detalle de producto desde marketing: ${sku}`);
                return res.render('modules/concesionarioProducto', {
                    producto,
                    returnTo: '/marketing/catalogo',
                    soloLectura: true,
                    resumenCalificaciones,
                    distribucionConPorcentaje,
                    resenas: Array.isArray(resenas) ? resenas : []
                });
            });
        });
    });
};
