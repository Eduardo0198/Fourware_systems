const express = require('express');
const router = express.Router();

const carritoController = require('../controllers/carrito.controller');
const { protegerRuta, tieneRol, requiereCuentaActiva } = require('../middlewares/auth.middleware');

router.post('/agregar',
    protegerRuta,
    tieneRol(['Concesionario']),
    requiereCuentaActiva,
    carritoController.agregarProducto
);

router.get('/',
    protegerRuta,
    tieneRol(['Concesionario']),
    requiereCuentaActiva,
    carritoController.verCarrito
);

router.get('/eliminar/:sku',
    protegerRuta,
    tieneRol(['Concesionario']),
    requiereCuentaActiva,
    carritoController.eliminarProducto
);

router.post('/actualizar-cantidad',
    protegerRuta,
    tieneRol(['Concesionario']),
    requiereCuentaActiva,
    carritoController.actualizarCantidad
);

router.post('/confirmar',
    protegerRuta,
    tieneRol(['Concesionario']),
    requiereCuentaActiva,
    carritoController.confirmarReserva
);

module.exports = router;
