const express = require('express');

const router = express.Router();
const adminController = require('../controllers/admin.controller');

router.get('/catalogo/registrar', adminController.registrarSKU);
router.get('/catalogo/modificar', adminController.modificarSKU);
router.get('/catalogo/carga-masiva', adminController.cargaMasiva);

router.get('/campanas/crear', adminController.crearCampana);
router.get('/campanas/editar', adminController.editarCampana);
router.get('/campanas/cancelacion', adminController.cancelacionCampana);
router.get('/campanas/estado', adminController.estadoCampana);

router.get('/dashboard', adminController.dashboard);
router.get('/catalogo', adminController.catalogo);
router.get('/campanas', adminController.campanas);
router.get('/reportes', adminController.reportes);
router.get('/auditoria', adminController.auditoria);


module.exports = router;