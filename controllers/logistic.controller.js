const reservaModel = require('../models/reserva.model');
// lau inicio
// Cargamos los catalogos para filtrar metricas por campaña y cuenta desde la base de datos
const campaniaModel = require('../models/campania.model');
const cuentaModel = require('../models/cuenta.model');
// lau fin
const { registrarEvento } = require('../utils/auditoria.helper');
const logger = require('../utils/logger');

function formatearFechaInput(fecha) {
  return fecha.toISOString().slice(0, 10);
}

function obtenerRangoFechas(query) {
  const hoy = new Date();
  const hace30Dias = new Date();
  hace30Dias.setDate(hace30Dias.getDate() - 30);

  const fechaInicio = String(query.fecha_inicio || formatearFechaInput(hace30Dias)).trim();
  const fechaFin = String(query.fecha_fin || formatearFechaInput(hoy)).trim();

  return { fechaInicio, fechaFin };
}

function esFechaInputValida(valor) {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor);
}

function construirResumenReservas(reservas) {
  return (reservas || []).reduce((acc, reserva) => {
    acc.totalReservas += 1;
    acc.totalImporte += Number(reserva.total || 0);
    acc.totalPeso += Number(reserva.peso_total || 0);
    acc.totalVolumen += Number(reserva.volumen_total || 0);
    return acc;
  }, {
    totalReservas: 0,
    totalImporte: 0,
    totalPeso: 0,
    totalVolumen: 0
  });
}

//lau inciio
function construirResumenMetricasVacio() {
  return {
    // Valores base mientras aun no consultamos metricas reales
    // Esto evita que la vista falle al intentar mostrar datos vacios
    totalPeso: 0,
    totalVolumen: 0,
    totalRegistros: 0
  };
}
// lau final

exports.reservasConfirmadas = (req, res) => {
  const { fechaInicio, fechaFin } = obtenerRangoFechas(req.query);

  if (!esFechaInputValida(fechaInicio) || !esFechaInputValida(fechaFin) || fechaInicio > fechaFin) {
    return res.render('logistica/reservasConfirmadas', {
      pageMessage: {
        tipo: 'danger',
        texto: 'Debes seleccionar un periodo válido para consultar reservas confirmadas.'
      },
      filtros: {
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin
      },
      reservas: [],
      resumen: construirResumenReservas([])
    });
  }

  reservaModel.obtenerReservasConfirmadasPorPeriodo(fechaInicio, fechaFin, (err, reservas) => {
    if (err) {
      logger.error(err);
      return res.render('logistica/reservasConfirmadas', {
        pageMessage: {
          tipo: 'danger',
          texto: 'No fue posible consultar las reservas confirmadas para el periodo seleccionado.'
        },
        filtros: {
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin
        },
        reservas: [],
        resumen: construirResumenReservas([])
      });
    }

    registrarEvento(req, 'Consulta de reservas confirmadas por periodo');
    res.render('logistica/reservasConfirmadas', {
      pageMessage: reservas.length === 0 ? {
        tipo: 'warning',
        texto: 'No existen reservas confirmadas para el periodo seleccionado.'
      } : null,
      filtros: {
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin
      },
      reservas: reservas || [],
      resumen: construirResumenReservas(reservas)
    });
  });
};

exports.metricas = (req, res) => {
  // Primero cargamos las campanias disponibles para el filtro.
  campaniaModel.obtenerTodas((campaniaErr, campanias) => {
    if (campaniaErr) {
      logger.error(campaniaErr);
    }

    // Despues cargamos las cuentas para mostrar ambos selectores en la vista.
    cuentaModel.obtenerTodas((cuentaErr, cuentas) => {
      if (cuentaErr) {
        logger.error(cuentaErr);
      }

      registrarEvento(req, 'Consulta de métricas logísticas');
      res.render('logistica/metricas', {
        pageMessage: campaniaErr || cuentaErr ? {
          tipo: 'warning',
          texto: 'No fue posible cargar todos los filtros de métricas.'
        } : null,
        filtros: {
          // Dejamos los filtros vacios en esta primera version.
          id_campania: '',
          id_cuenta: ''
        },
        campanias: Array.isArray(campanias) ? campanias : [],
        cuentas: Array.isArray(cuentas) ? cuentas : [],
        resumen: construirResumenMetricasVacio()
      });
    });
  });
};

exports.reporteOperativo = (req, res) => {
  registrarEvento(req, 'Generación de reporte operativo logístico');
  res.render('logistica/reporteOperativo');
};
