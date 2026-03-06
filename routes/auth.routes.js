const express = require('express');

const router = express.Router();
const authController = require('../controllers/auth.controller');

router.get('/', authController.login);
router.post('/login', authController.doLogin);

module.exports = router;