const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');

const { protegerRuta, tieneRol, tienePrivilegio } = require('../middlewares/auth.middleware');

router.get('/dashboard',
    protegerRuta,
    tieneRol(['Administrador']),
    adminController.dashboard
);

router.get('/catalogo',
    protegerRuta,
    tieneRol(['Administrador']),
    adminController.catalogo
);

router.get('/catalogo/registrar',
    protegerRuta,
    tieneRol(['Administrador']),
    tienePrivilegio(['registrar_producto_catalogo']), 
    adminController.registrarSKU
);

router.get('/catalogo/modificar',
    protegerRuta,
    tieneRol(['Administrador']),
    tienePrivilegio(['modificar_producto']), 
    adminController.modificarSKU
);

router.get('/catalogo/carga-masiva',
    protegerRuta,
    tieneRol(['Administrador']),
    tienePrivilegio(['carga_masiva_productos']), 
    adminController.cargaMasiva
);

router.get('/campanas',
    protegerRuta,
    tieneRol(['Administrador']),
    adminController.campanas
);

router.get('/campanas/crear',
    protegerRuta,
    tieneRol(['Administrador']),
    tienePrivilegio(['configurar_campania']), 
    adminController.crearCampana
);

router.get('/campanas/editar',
    protegerRuta,
    tieneRol(['Administrador']),
    tienePrivilegio(['configurar_campania']), 
    adminController.editarCampana
);

router.get('/campanas/cancelacion',
    protegerRuta,
    tieneRol(['Administrador']),
    tienePrivilegio(['configurar_ventana_cancelacion']), 
    adminController.cancelacionCampana
);

router.get('/campanas/estado',
    protegerRuta,
    tieneRol(['Administrador']),
    adminController.estadoCampana
);

router.get('/reportes',
    protegerRuta,
    tieneRol(['Administrador']),
    tienePrivilegio(['generar_reporte_preventas']), 
    adminController.reportes
);

router.get('/auditoria',
    protegerRuta,
    tieneRol(['Administrador']),
    tienePrivilegio(['consultar_bitacora']), 
    adminController.auditoria
);

module.exports = router;