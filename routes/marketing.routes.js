const express = require('express');

const router = express.Router();
const marketingController = require('../controllers/marketing.controller');

router.get('/metricas-comparativas', marketingController.metricasComparativas);
router.get('/ranking-productos', marketingController.rankingProductos);
router.get('/tendencias-region', marketingController.tendenciasRegion);

module.exports = router;