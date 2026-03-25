const express = require('express');

const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { requireAdminSession } = require('../middleware/auth.middleware');

router.use(requireAdminSession);

router.get('/catalogo/registrar', adminController.registrarSKU);
router.post('/catalogo/registrar', adminController.registrarSKUPost);
router.get('/catalogo/modificar', adminController.modificarSKU);
router.get('/catalogo/carga-masiva', adminController.cargaMasiva);

router.get('/campanas/crear', adminController.crearCampana);
router.post('/campanas/crear', adminController.crearCampanaPost);
router.get('/campanas/editar', adminController.editarCampana);
router.post('/campanas/editar/:id', adminController.editarCampanaPost);
router.get('/campanas/cancelacion', adminController.cancelacionCampana);
router.post('/campanas/cancelacion', adminController.cancelacionCampanaPost);
router.get('/campanas/estado', adminController.estadoCampana);
router.post('/campanas/estado/:id/activar', adminController.activarCampana);
router.post('/campanas/estado/:id/desactivar', adminController.desactivarCampana);

router.get('/dashboard', adminController.dashboard);
router.get('/catalogo', adminController.catalogo);
router.get('/campanas', adminController.campanas);
router.get('/reportes', adminController.reportes);
router.get('/auditoria', adminController.auditoria);

module.exports = router;
