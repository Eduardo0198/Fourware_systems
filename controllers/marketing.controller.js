const metricasModel = require('../models/metricas.model');
const XLSX = require('xlsx');
const { registrarEvento } = require('../utils/auditoria.helper');
const logger = require('../utils/logger');

exports.metricasComparativas = (req, res) => {
    registrarEvento(req, 'Consulta de métricas comparativas de campaña');
    res.render('marketing/metricasComparativas');
};

exports.rankingProductos = (req, res) => {
    registrarEvento(req, 'Consulta de ranking de productos');
    res.render('marketing/rankingProductos');
};

exports.tendenciasRegion = (req, res) => {
    registrarEvento(req, 'Consulta de tendencias por región');
    res.render('marketing/tendenciasRegion');
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
                pageMessage: { tipo: 'warning', texto: 'No hay campañas con reservas registradas.' }
            });
        }

        registrarEvento(req, 'Acceso a consulta de ranking de productos y métricas comparativas');
        return res.render('marketing/metricasRanking', {
            campanias,
            sinCampanias: false,
            resultados: null,
            filtros: {},
            pageMessage: null
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
