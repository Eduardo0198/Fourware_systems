const express = require('express');
const router = express.Router();
const concesionarioController =
    require('../controllers/concesionario.controller');

router.get(
    '/catalogo',
    concesionarioController.catalogo
);

router.get(
    '/producto/:sku',
    concesionarioController.producto
);

router.get(
    '/confirmar-reserva',
    concesionarioController.confirmarReserva
);

router.get(
    '/reservas',
    concesionarioController.reservas
);

router.get(
    '/reserva/:folio',
    concesionarioController.detalleReserva
);

router.get(
    '/cancelar-reserva',
    concesionarioController.cancelarReserva
);

module.exports = router;