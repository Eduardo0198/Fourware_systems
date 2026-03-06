const express = require('express');

const router = express.Router();
const adminController = require('../controllers/logistic.controller');

router.get('/reservas-confirmadas', adminController.reservasConfirmadas);
router.get('/metricas', adminController.metricas);
router.get('/reporte-operativo', adminController.reporteOperativo);

module.exports = router;