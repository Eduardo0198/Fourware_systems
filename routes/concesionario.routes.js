const express = require('express');
const router = express.Router();
const concesionarioController = require('../controllers/concesionario.controller');

const { protegerRuta, tieneRol, tienePrivilegio } = require('../middlewares/auth.middleware');

router.get('/home',
    protegerRuta,
    tieneRol(['Concesionario']),
    concesionarioController.home
);

router.get('/catalogo',
    protegerRuta,
    tieneRol(['Concesionario']),
    concesionarioController.catalogo
);


router.get('/producto/:sku',
    protegerRuta,
    tieneRol(['Concesionario']),
    concesionarioController.producto
);

router.get('/confirmar-reserva',
    protegerRuta,
    tieneRol(['Concesionario']),
    tienePrivilegio(['crear_reserva']),
    concesionarioController.confirmarReserva
);

router.get('/reservas',
    protegerRuta,
    tieneRol(['Concesionario']),
    concesionarioController.reservas
);

router.get('/reserva/:folio',
    protegerRuta,
    tieneRol(['Concesionario']),
    concesionarioController.detalleReserva
);

router.get('/cancelar-reserva',
    protegerRuta,
    tieneRol(['Concesionario']),
    tienePrivilegio(['cancelar_reserva']),
    concesionarioController.cancelarReserva
);

module.exports = router;