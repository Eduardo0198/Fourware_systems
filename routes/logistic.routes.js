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

// ********************
// Esta ruta se usa cuando logistica cambia el estado de una reserva
// El folio viaja en la URL para saber que reserva se va a actualizar
router.post('/reservas/:folio/estado-logistico',
    // Primero reviso que el usuario haya iniciado sesion
    protegerRuta,
    // Despues valido que el usuario tenga el rol de Logistica
    tieneRol(['Logistica']),
    // Aqui uso el privilegio que ya existe para el modulo de reservas logisticas
    tienePrivilegio(['consultar_reservas_logistica']),
    // Si pasa las validaciones, mando la peticion al controlador
    logisticController.actualizarEstadoLogistico
);
// ********************

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

// lau y eduardo inicio ruta exportar cu-18
router.post('/reporte-operativo/exportar',
    protegerRuta,
    tieneRol(['Logistica']),
    tienePrivilegio(['generar_reporte_logistica']),
    logisticController.exportarReporteOperativo
);
// lau y eduardo final ruta exportar cu-18

module.exports = router;
