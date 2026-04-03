const express = require('express');
const router = express.Router();
const multer = require('multer');
const adminController = require('../controllers/admin.controller');

const { protegerRuta, tieneRol, tienePrivilegio } = require('../middlewares/auth.middleware');
const uploadCargaMasiva = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

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

router.post('/catalogo/registrar',
    protegerRuta,
    tieneRol(['Administrador']),
    tienePrivilegio(['registrar_producto_catalogo']),
    adminController.registrarSKUPost
);

router.get('/catalogo/modificar',
    protegerRuta,
    tieneRol(['Administrador']),
    tienePrivilegio(['modificar_producto']), 
    adminController.modificarSKU
);

router.post('/catalogo/modificar/:sku',
    protegerRuta,
    tieneRol(['Administrador']),
    tienePrivilegio(['modificar_producto']),
    adminController.modificarSKUPost
);

router.get('/catalogo/carga-masiva',
    protegerRuta,
    tieneRol(['Administrador']),
    tienePrivilegio(['carga_masiva_productos']), 
    adminController.cargaMasiva
);

router.post('/catalogo/carga-masiva',
    protegerRuta,
    tieneRol(['Administrador']),
    tienePrivilegio(['carga_masiva_productos']),
    uploadCargaMasiva.single('archivo'),
    adminController.cargaMasivaPost
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

router.post('/campanas/crear',
    protegerRuta,
    tieneRol(['Administrador']),
    tienePrivilegio(['configurar_campania']),
    adminController.crearCampanaPost
);

router.get('/campanas/editar',
    protegerRuta,
    tieneRol(['Administrador']),
    tienePrivilegio(['configurar_campania']), 
    adminController.editarCampana
);

router.post('/campanas/editar/:id',
    protegerRuta,
    tieneRol(['Administrador']),
    tienePrivilegio(['configurar_campania']),
    adminController.editarCampanaPost
);

router.get('/campanas/cancelacion',
    protegerRuta,
    tieneRol(['Administrador']),
    tienePrivilegio(['configurar_ventana_cancelacion']), 
    adminController.cancelacionCampana
);

router.post('/campanas/cancelacion',
    protegerRuta,
    tieneRol(['Administrador']),
    tienePrivilegio(['configurar_ventana_cancelacion']),
    adminController.cancelacionCampanaPost
);

router.get('/campanas/estado',
    protegerRuta,
    tieneRol(['Administrador']),
    adminController.estadoCampana
);

router.post('/campanas/estado/:id/activar',
    protegerRuta,
    tieneRol(['Administrador']),
    tienePrivilegio(['configurar_campania']),
    adminController.activarCampana
);

router.post('/campanas/estado/:id/desactivar',
    protegerRuta,
    tieneRol(['Administrador']),
    tienePrivilegio(['configurar_campania']),
    adminController.desactivarCampana
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
