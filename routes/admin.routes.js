const express = require('express');

const router = express.Router();
const adminController = require('../controllers/admin.controller');

router.get('/dashboard', adminController.dashboard);
router.get('/catalogo', adminController.catalogo);
router.get('/campanas', adminController.campanas);

module.exports = router;