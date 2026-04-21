const reservaModel = require('../models/reserva.model');
const campaniaModel = require('../models/campania.model');
const cuentaModel = require('../models/cuenta.model');
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

function normalizarIdFiltro(valor) {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function obtenerFiltrosMetricas(query) {
  const { fechaInicio, fechaFin } = obtenerRangoFechas(query);
  const agruparPor = query.agrupar_por === 'cuenta' ? 'cuenta' : 'campania';

  return {
    fechaInicio,
    fechaFin,
    agruparPor,
    idCampania: normalizarIdFiltro(query.id_campania),
    idCuenta: normalizarIdFiltro(query.id_cuenta)
  };
}

function construirResumenMetricas(metricas) {
  return (metricas || []).reduce((acc, item) => {
    acc.totalReservas += Number(item.total_reservas || 0);
    acc.totalProductos += Number(item.total_productos || 0);
    acc.totalPeso += Number(item.peso_total || 0);
    acc.totalVolumen += Number(item.volumen_total || 0);
    acc.totalImporte += Number(item.importe_productos || 0);
    return acc;
  }, {
    totalReservas: 0,
    totalProductos: 0,
    totalPeso: 0,
    totalVolumen: 0,
    totalImporte: 0
  });
}

function construirFiltrosVista(filtros) {
  return {
    fecha_inicio: filtros.fechaInicio,
    fecha_fin: filtros.fechaFin,
    agrupar_por: filtros.agruparPor,
    id_campania: filtros.idCampania || '',
    id_cuenta: filtros.idCuenta || ''
  };
}

function cargarCatalogosMetricas(callback) {
  campaniaModel.obtenerTodas((errCampanias, campanias) => {
    if (errCampanias) return callback(errCampanias);

    cuentaModel.obtenerTodas((errCuentas, cuentas) => {
      if (errCuentas) return callback(errCuentas);
      callback(null, { campanias: campanias || [], cuentas: cuentas || [] });
    });
  });
}

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
  const filtros = obtenerFiltrosMetricas(req.query);

  const renderMetricas = (pageMessage, metricas, serieTiempo, catalogos) => res.render('logistica/metricas', {
    pageMessage,
    filtros: construirFiltrosVista(filtros),
    metricas: metricas || [],
    serieTiempo: serieTiempo || [],
    resumen: construirResumenMetricas(metricas),
    campanias: catalogos.campanias,
    cuentas: catalogos.cuentas
  });

  cargarCatalogosMetricas((catalogosErr, catalogos) => {
    const catalogosVista = catalogos || { campanias: [], cuentas: [] };

    if (catalogosErr) {
      logger.error(catalogosErr);
      return renderMetricas({
        tipo: 'danger',
        texto: 'No fue posible cargar los filtros de campaña y cuenta.'
      }, [], [], catalogosVista);
    }

    if (!esFechaInputValida(filtros.fechaInicio) || !esFechaInputValida(filtros.fechaFin) || filtros.fechaInicio > filtros.fechaFin) {
      return renderMetricas({
        tipo: 'danger',
        texto: 'Debes seleccionar un periodo válido para consultar métricas logísticas.'
      }, [], [], catalogosVista);
    }

    reservaModel.obtenerMetricasLogisticasConsolidadas(filtros, (err, metricas) => {
      if (err) {
        logger.error(err);
        return renderMetricas({
          tipo: 'danger',
          texto: 'No fue posible consultar las métricas logísticas consolidadas.'
        }, [], [], catalogosVista);
      }

      reservaModel.obtenerSerieTiempoMetricasLogisticas(filtros, (serieErr, serieTiempo) => {
        if (serieErr) {
          logger.error(serieErr);
          return renderMetricas({
            tipo: 'danger',
            texto: 'No fue posible consultar la serie temporal de metricas logisticas.'
          }, metricas || [], [], catalogosVista);
        }

        registrarEvento(req, 'Consulta de metricas logisticas consolidadas');
        renderMetricas(metricas.length === 0 ? {
          tipo: 'warning',
          texto: 'No existen reservas confirmadas con los filtros seleccionados.'
        } : null, metricas, serieTiempo, catalogosVista);
      });
    });
  });
};

exports.reporteOperativo = (req, res) => {
  registrarEvento(req, 'Generación de reporte operativo logístico');
  res.render('logistica/reporteOperativo');
};
