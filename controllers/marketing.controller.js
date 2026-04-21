const logger = require('../utils/logger');
const { registrarEvento } = require('../utils/auditoria.helper');
const calificacionModel = require('../models/calificacion.model');

const CRITERIO_NOMBRE_VALIDO = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9][A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s.,-]*$/;

function obtenerPercepcionGeneral(promedio, totalCalificaciones) {
  if (!totalCalificaciones) return 'Sin opiniones';
  if (promedio >= 4) return 'Percepción positiva';
  if (promedio >= 3) return 'Percepción neutra';
  return 'Área de mejora';
}

function renderRankingProductos(res, payload) {
  calificacionModel.obtenerPromedioCalificacionesPorCampaniaActiva((err, graficaCampanias) => {
    if (err) {
      logger.error(err);
      return res.render('marketing/rankingProductos', {
        ...payload,
        graficaCampanias: [],
        pageMessage: payload.pageMessage || {
          tipo: 'warning',
          texto: 'No fue posible cargar la gráfica de campañas activas.'
        }
      });
    }

    const datos = (graficaCampanias || []).map((item) => {
      const promedio = Number(item.promedio_estrellas || 0);
      return {
        ...item,
        promedio_estrellas: promedio,
        total_calificaciones: Number(item.total_calificaciones || 0),
        porcentaje: Math.min(100, Math.round((promedio / 5) * 100))
      };
    });

    return res.render('marketing/rankingProductos', {
      ...payload,
      graficaCampanias: datos
    });
  });
}

exports.metricasComparativas = (req, res) => {
  registrarEvento(req, 'Consulta de métricas comparativas de campaña');
  res.render('marketing/metricasComparativas');
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

exports.tendenciasRegion = (req, res) => {
  registrarEvento(req, 'Consulta de tendencias por región');
  res.render('marketing/tendenciasRegion');
};
