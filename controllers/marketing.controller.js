const metricasModel = require('../models/metricas.model');
const campaniaModel = require('../models/campania.model');
const reservaModel = require('../models/reserva.model');
const concesionarioModel = require('../models/concesionario.model');
const XLSX = require('xlsx');
const { registrarEvento } = require('../utils/auditoria.helper');
const logger = require('../utils/logger');
const calificacionModel = require('../models/calificacion.model');

const CRITERIO_NOMBRE_VALIDO = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9][A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s.,-]*$/;

function obtenerPercepcionGeneral(promedio, totalCalificaciones) {
  if (!totalCalificaciones) return 'Sin opiniones';
  if (promedio >= 4) return 'Percepción positiva';
  if (promedio >= 3) return 'Percepción neutra';
  return 'Área de mejora';
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

    calificacionModel.obtenerRankingProductosPorCalificacion('DESC', 20, (errMejores, mejores) => {
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
    return renderRankingProductos(res, {
      criterios: { nombre: '' },
      resultados: [],
      pageMessage: null
    });
  }

  if (!CRITERIO_NOMBRE_VALIDO.test(nombre)) {
    registrarEvento(req, 'Intento de consulta con criterios inválidos de calificaciones y comentarios');
    return renderRankingProductos(res, {
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
      return renderRankingProductos(res, {
        criterios: { nombre },
        resultados: [],
        pageMessage: {
          tipo: 'danger',
          texto: 'Error al procesar información.'
        }
      });
    }

    const resultadosNormalizados = (resultados || []).map((item) => {
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

    if (!resultadosNormalizados.length) {
      registrarEvento(req, 'Consulta sin resultados de calificaciones y comentarios de productos');
      return renderRankingProductos(res, {
        criterios: { nombre },
        resultados: [],
        pageMessage: {
          tipo: 'warning',
          texto: 'No existen calificaciones ni comentarios registrados para los criterios seleccionados.'
        }
      });
    }

    registrarEvento(req, 'Consulta de resultados de calificaciones y comentarios de productos');
    return renderRankingProductos(res, {
      criterios: { nombre },
      resultados: resultadosNormalizados,
      pageMessage: null
    });
  });
};

exports.metricasRanking = (req, res) => {
    metricasModel.obtenerCampaniasConReservas((err, campanias) => {
        if (err) {
            logger.error(err);
            registrarEvento(req, 'Error al cargar campañas para métricas de ranking');
            return res.render('marketing/metricasRanking', {
                campanias: [],
                sinCampanias: true,
                resultados: null,
                filtros: {},
                campaniaActivaId: null,
                pageMessage: { tipo: 'danger', texto: 'Error al cargar las campañas.' }
            });
        }

        if (!campanias || campanias.length === 0) {
            registrarEvento(req, 'Consulta de métricas sin campañas con reservas activas');
            return res.render('marketing/metricasRanking', {
                campanias: [],
                sinCampanias: true,
                resultados: null,
                filtros: {},
                campaniaActivaId: null,
                pageMessage: { tipo: 'warning', texto: 'No hay campañas con reservas registradas.' }
            });
        }

        campaniaModel.obtenerCampaniaActiva((errActiva, activas) => {
            const campaniaActiva = Array.isArray(activas) && activas.length > 0 ? activas[0] : null;
            const campaniaActivaId = campaniaActiva ? campaniaActiva.id_campania : null;

            if (!campaniaActivaId) {
                registrarEvento(req, 'Acceso a consulta de ranking sin campaña activa');
                return res.render('marketing/metricasRanking', {
                    campanias,
                    sinCampanias: false,
                    resultados: null,
                    filtros: {},
                    campaniaActivaId: null,
                    pageMessage: null
                });
            }

            const filtros = { idCampania: campaniaActivaId, fechaInicio: null, fechaFin: null, producto: null };

            metricasModel.consultarRankingProductos(filtros, (errRanking, ranking) => {
                metricasModel.consultarMetricasComparativas(filtros, (errMetricas, metricas) => {
                    if (errRanking || errMetricas) {
                        if (errRanking) logger.error(errRanking);
                        if (errMetricas) logger.error(errMetricas);
                    }

                    registrarEvento(req, 'Acceso a consulta de ranking de productos y métricas comparativas');
                    return res.render('marketing/metricasRanking', {
                        campanias,
                        sinCampanias: false,
                        resultados: {
                            ranking: errRanking ? [] : (ranking || []),
                            metricas: errMetricas ? [] : (metricas || [])
                        },
                        filtros: { idCampania: campaniaActivaId },
                        campaniaActivaId,
                        pageMessage: null
                    });
                });
            });
        });
    });
};

exports.consultarMetricas = (req, res) => {
    const { idCampania, fechaInicio, fechaFin, producto } = req.body;

    if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
        return metricasModel.obtenerCampaniasConReservas((err, campanias) => {
            return res.render('marketing/metricasRanking', {
                campanias: err ? [] : (campanias || []),
                sinCampanias: false,
                resultados: null,
                filtros: { idCampania, fechaInicio, fechaFin, producto },
                pageMessage: { tipo: 'danger', texto: 'La fecha de fin no puede ser anterior a la fecha de inicio.' }
            });
        });
    }

    const filtros = { idCampania, fechaInicio, fechaFin, producto };

    metricasModel.obtenerCampaniasConReservas((errCamp, campanias) => {
        if (errCamp) {
            logger.error(errCamp);
            registrarEvento(req, 'Error al cargar campañas en consulta de métricas');
            return res.render('marketing/metricasRanking', {
                campanias: [],
                sinCampanias: false,
                resultados: null,
                filtros,
                pageMessage: { tipo: 'danger', texto: 'Error al cargar los datos.' }
            });
        }

        metricasModel.consultarRankingProductos(filtros, (errRanking, ranking) => {
            if (errRanking) {
                logger.error(errRanking);
                registrarEvento(req, 'Error al consultar ranking de productos');
                return res.render('marketing/metricasRanking', {
                    campanias: campanias || [],
                    sinCampanias: false,
                    resultados: null,
                    filtros,
                    pageMessage: { tipo: 'danger', texto: 'Error al consultar el ranking.' }
                });
            }

            metricasModel.consultarMetricasComparativas(filtros, (errMetricas, metricas) => {
                if (errMetricas) {
                    logger.error(errMetricas);
                    registrarEvento(req, 'Error al consultar métricas comparativas');
                    return res.render('marketing/metricasRanking', {
                        campanias: campanias || [],
                        sinCampanias: false,
                        resultados: null,
                        filtros,
                        pageMessage: { tipo: 'danger', texto: 'Error al consultar las métricas.' }
                    });
                }

                registrarEvento(req, 'Consulta de ranking de productos y métricas comparativas por campaña');
                return res.render('marketing/metricasRanking', {
                    campanias: campanias || [],
                    sinCampanias: false,
                    resultados: { ranking: ranking || [], metricas: metricas || [] },
                    filtros,
                    pageMessage: ranking && ranking.length === 0
                        ? { tipo: 'info', texto: 'No se encontraron productos con los filtros aplicados.' }
                        : null
                });
            });
        });
    });
};

exports.exportarMetricas = (req, res) => {
    const { idCampania, fechaInicio, fechaFin, producto } = req.body;
    const filtros = { idCampania, fechaInicio, fechaFin, producto };

    metricasModel.consultarRankingProductos(filtros, (errRanking, ranking) => {
        if (errRanking) {
            logger.error(errRanking);
            registrarEvento(req, 'Error al exportar ranking de productos');
            return res.status(500).json({ ok: false, mensaje: 'Error al exportar los datos.' });
        }

        metricasModel.consultarMetricasComparativas(filtros, (errMetricas, metricas) => {
            if (errMetricas) {
                logger.error(errMetricas);
                registrarEvento(req, 'Error al exportar métricas comparativas');
                return res.status(500).json({ ok: false, mensaje: 'Error al exportar los datos.' });
            }

            const wb = XLSX.utils.book_new();

            const rankingData = (ranking || []).map(r => ({
                'Posición': r.posicion,
                'SKU': r.SKU,
                'Producto': r.nombre_comercial,
                'Unidades vendidas': r.total_unidades,
                'Campaña': r.nombre_campania,
                'Total órdenes campaña': r.total_ordenes_campania,
                'Monto total campaña': r.monto_total_campania
            }));
            const wsRanking = XLSX.utils.json_to_sheet(rankingData);
            XLSX.utils.book_append_sheet(wb, wsRanking, 'Ranking');

            const metricasData = (metricas || []).map(m => ({
                'Campaña': m.nombre_campania,
                'Total órdenes': m.total_ordenes,
                'Monto total': m.monto_total
            }));
            const wsMetricas = XLSX.utils.json_to_sheet(metricasData);
            XLSX.utils.book_append_sheet(wb, wsMetricas, 'Métricas comparativas');

            const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

            registrarEvento(req, 'Exportación de ranking de productos y métricas comparativas');
            res.setHeader('Content-Disposition', 'attachment; filename="metricas_ranking.xlsx"');
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            return res.send(buffer);
        });
    });
};
