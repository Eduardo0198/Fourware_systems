const { registrarEvento } = require('../utils/auditoria.helper');

exports.metricasComparativas = (req, res) => {
  // inicio caso 8 lau
  registrarEvento(req, 'Consulta de métricas comparativas de campaña');
  // fin caso 8 lau
  res.render('marketing/metricasComparativas');
};

exports.rankingProductos = (req, res) => {
  // inicio caso 8 lau
  registrarEvento(req, 'Consulta de ranking de productos');
  // fin caso 8 lau
  res.render('marketing/rankingProductos');
};

exports.tendenciasRegion = (req, res) => {
  // inicio caso 8 lau
  registrarEvento(req, 'Consulta de tendencias por región');
  // fin caso 8 lau
  res.render('marketing/tendenciasRegion');
};
