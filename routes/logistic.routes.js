const express = require('express');
const router = express.Router();
const logisticController = require('../controllers/logistic.controller');

const { protegerRuta, tieneRol, tienePrivilegio } = require('../middlewares/auth.middleware');

router.get('/reservas-confirmadas',
    protegerRuta,
    tieneRol(['Logistica']),
    tienePrivilegio(['consultar_reservas_logistica']), 
    logisticController.reservasConfirmadas
);

router.get('/metricas',
    protegerRuta,
    tieneRol(['Logistica']),
    tienePrivilegio(['consultar_metricas_logistica']), 
    logisticController.metricas
);

router.get('/reporte-operativo',
    protegerRuta,
    tieneRol(['Logistica']),
    tienePrivilegio(['generar_reporte_logistica']), 
    logisticController.reporteOperativo
);

module.exports = router;