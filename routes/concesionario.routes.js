const express = require('express');
const router = express.Router();
const concesionarioController = require('../controllers/concesionario.controller');

const {
    protegerRuta,
    tieneRol,
    tienePrivilegio,
    requiereCuentaActiva
} = require('../middlewares/auth.middleware');

router.get('/home',
    protegerRuta,
    tieneRol(['Concesionario']),
    concesionarioController.home
);

router.get('/catalogo',
    protegerRuta,
    tieneRol(['Concesionario']),
    requiereCuentaActiva,
    concesionarioController.catalogo
);


router.get('/producto/:sku',
    protegerRuta,
    tieneRol(['Concesionario']),
    requiereCuentaActiva,
    concesionarioController.producto
);

router.post('/cuenta-activa',
    protegerRuta,
    tieneRol(['Concesionario']),
    concesionarioController.seleccionarCuentaActiva
);

router.get('/confirmar-reserva',
    protegerRuta,
    tieneRol(['Concesionario']),
    requiereCuentaActiva,
    tienePrivilegio(['crear_reserva']),
    concesionarioController.confirmarReserva
);

router.get('/reservas',
    protegerRuta,
    tieneRol(['Concesionario']),
    requiereCuentaActiva,
    concesionarioController.reservas
);

router.get('/reserva/:folio',
    protegerRuta,
    tieneRol(['Concesionario']),
    requiereCuentaActiva,
    concesionarioController.detalleReserva
);

router.get('/cancelar-reserva',
    protegerRuta,
    tieneRol(['Concesionario']),
    requiereCuentaActiva,
    tienePrivilegio(['cancelar_reserva']),
    concesionarioController.cancelarReserva
);

module.exports = router;
