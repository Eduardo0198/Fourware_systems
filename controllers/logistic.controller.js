const { registrarEvento } = require('../utils/auditoria.helper');

exports.reservasConfirmadas = (req, res) => {
  // inicio caso 8 lau
  registrarEvento(req, 'Consulta de reservas confirmadas por periodo');
  // fin caso 8 lau
  res.render('logistica/reservasConfirmadas');
};

exports.metricas = (req, res) => {
  // inicio caso 8 lau
  registrarEvento(req, 'Consulta de métricas logísticas');
  // fin caso 8 lau
  res.render('logistica/metricas');
};

exports.reporteOperativo = (req, res) => {
  // inicio caso 8 lau
  registrarEvento(req, 'Generación de reporte operativo logístico');
  // fin caso 8 lau
  res.render('logistica/reporteOperativo');
};
