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

const uploadImagenProducto = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        cb(null, allowed.includes(file.mimetype));
    }
});

router.get('/dashboard',
    protegerRuta,
    tieneRol(['Administrador']),
    adminController.dashboard
);

router.get('/inicio',
    protegerRuta,
    tieneRol(['Administrador']),
    adminController.inicio
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
    uploadImagenProducto.single('imagenArchivo'),
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
    uploadImagenProducto.single('imagenArchivo'),
    adminController.modificarSKUPost
);

router.post('/catalogo/eliminar/:sku',
    protegerRuta,
    tieneRol(['Administrador']),
    tienePrivilegio(['modificar_producto']),
    adminController.eliminarSKUPost
);

router.get('/catalogo/carga-masiva',
    protegerRuta,
    tieneRol(['Administrador']),
    tienePrivilegio(['carga_masiva_productos']),
    adminController.cargaMasiva
);

router.get('/catalogo/carga-masiva/plantilla',
    protegerRuta,
    tieneRol(['Administrador']),
    tienePrivilegio(['carga_masiva_productos']),
    adminController.descargarPlantillaCargaMasiva
);

router.post('/catalogo/carga-masiva',
    protegerRuta,
    tieneRol(['Administrador']),
    tienePrivilegio(['carga_masiva_productos']),
    uploadCargaMasiva.single('archivo'),
    adminController.cargaMasivaPost
);

router.get('/catalogo/estado',
    protegerRuta,
    tieneRol(['Administrador']),
    tienePrivilegio(['modificar_producto']),
    adminController.estadoCatalogo
);

router.post('/catalogo/estado/:sku',
    protegerRuta,
    tieneRol(['Administrador']),
    tienePrivilegio(['modificar_producto']),
    adminController.toggleEstadoProducto
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
    uploadImagenProducto.single('bannerArchivo'),
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
    uploadImagenProducto.single('bannerArchivo'),
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

router.post('/reportes',
    protegerRuta,
    tieneRol(['Administrador']),
    tienePrivilegio(['generar_reporte_preventas']),
    adminController.reportesPost
);

router.get('/auditoria',
    protegerRuta,
    tieneRol(['Administrador']),
    tienePrivilegio(['consultar_bitacora']),
    adminController.auditoria
);

router.get('/auditoria/exportar',
    protegerRuta,
    tieneRol(['Administrador']),
    tienePrivilegio(['consultar_bitacora']),
    adminController.exportarBitacora
);

module.exports = router;
