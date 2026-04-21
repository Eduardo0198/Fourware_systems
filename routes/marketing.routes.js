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

router.get('/metricas-ranking',
    protegerRuta,
    tieneRol(['Marketing']),
    tienePrivilegio(['consultar_ranking_productos']),
    marketingController.metricasRanking
);

router.post('/consultar-metricas',
    protegerRuta,
    tieneRol(['Marketing']),
    tienePrivilegio(['consultar_ranking_productos']),
    marketingController.consultarMetricas
);

router.post('/exportar-metricas',
    protegerRuta,
    tieneRol(['Marketing']),
    tienePrivilegio(['consultar_ranking_productos']),
    marketingController.exportarMetricas
);

module.exports = router;