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
    //CU03-Paso 10:
    //El carrito es un ejemplo de ruta operativa que pasa por
    //requiereCuentaActiva antes de llegar al controlador.
    requiereCuentaActiva,
    carritoController.verCarrito
);

router.post('/eliminar',
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
