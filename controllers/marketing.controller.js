const { registrarEvento } = require('../utils/auditoria.helper');

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
