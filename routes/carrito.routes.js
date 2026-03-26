const express = require('express');
const router = express.Router();

const carritoController = require('../controllers/carrito.controller');
const { protegerRuta, tieneRol } = require('../middlewares/auth.middleware');

router.post('/agregar',
    protegerRuta,
    tieneRol(['Concesionario']),
    carritoController.agregarProducto
);

router.get('/',
    protegerRuta,
    tieneRol(['Concesionario']),
    carritoController.verCarrito
);

router.get('/eliminar/:sku',
    protegerRuta,
    tieneRol(['Concesionario']),
    carritoController.eliminarProducto
);

// caso 4 lau: ruta para modificar la cantidad de un producto existente en el carrito

router.post('/actualizar/:sku',
    protegerRuta,
    tieneRol(['Concesionario']),
    carritoController.actualizarCantidad
);

//fin caso 4 lau 

router.post('/confirmar',
    protegerRuta,
    tieneRol(['Concesionario']),
    carritoController.confirmarReserva
);

module.exports = router;
