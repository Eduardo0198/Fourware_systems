const express = require('express');
const router = express.Router();
const marketingController = require('../controllers/marketing.controller');

const { protegerRuta, tieneRol, tienePrivilegio } = require('../middlewares/auth.middleware');

router.get('/metricas-comparativas',
    protegerRuta,
    tieneRol(['Marketing']),
    marketingController.metricasComparativas
);

router.get('/ranking-productos',
    protegerRuta,
    tieneRol(['Marketing']),
    tienePrivilegio(['consultar_ranking_productos']),
    marketingController.rankingProductos
);

router.get('/tendencias-region',
    protegerRuta,
    tieneRol(['Marketing']),
    marketingController.tendenciasRegion
);

module.exports = router;