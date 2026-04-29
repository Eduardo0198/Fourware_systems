const express = require('express');
const router = express.Router();
const marketingController = require('../controllers/marketing.controller');

const { protegerRuta, tieneRol, tienePrivilegio } = require('../middlewares/auth.middleware');

router.get('/inicio',
    protegerRuta,
    tieneRol(['Marketing']),
    marketingController.inicio
);

router.get('/ranking-productos',
    protegerRuta,
    tieneRol(['Marketing']),
    tienePrivilegio(['consultar_ranking_productos']),
    marketingController.rankingProductos
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

router.get('/catalogo',
    protegerRuta,
    tieneRol(['Marketing']),
    marketingController.catalogo
);

router.get('/catalogo/:sku',
    protegerRuta,
    tieneRol(['Marketing']),
    marketingController.detalleProducto
);

module.exports = router;