const db = require('../config/db');
const concesionarioModel = require('../models/concesionario.model');

exports.home = (req, res) => {
    concesionarioModel.obtenerTopProductos((err, productos) => {
        if (err) {
            console.log(err);
            return res.send("Error");
        }
        res.render('modules/concesionarioHome', {
            productos: productos
        });
    });
};

exports.catalogo = (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;

    // Parámetros de filtro
    const searchTerm = req.query.q || '';

    // Procesar precio mínimo: solo si es un número válido
    let precio_min;
    if (req.query.precio_min !== undefined && !isNaN(parseFloat(req.query.precio_min)) && typeof req.query.precio_min !== 'object') {
        precio_min = parseFloat(req.query.precio_min);
    } else {
        precio_min = undefined;
    }

    // Procesar precio máximo
    let precio_max;
    if (req.query.precio_max !== undefined && !isNaN(parseFloat(req.query.precio_max)) && typeof req.query.precio_max !== 'object') {
        precio_max = parseFloat(req.query.precio_max);
    } else {
        precio_max = undefined;
    }

    const unidad_venta = (typeof req.query.unidad_venta === 'string') ? req.query.unidad_venta : '';

    // Obtener productos paginados con filtros
    concesionarioModel.obtenerProductosPaginados(page, limit, searchTerm, precio_min, precio_max, unidad_venta, (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error al cargar el catálogo');
        }

        // Obtener lista de unidades de venta únicas para el select
        concesionarioModel.obtenerUnidadesVenta((err, unidades) => {
            if (err) {
                console.error(err);
                unidades = [];
            }

            // Asegurar que unidades sea un array de strings
            if (!Array.isArray(unidades)) unidades = [];
            unidades = unidades.map(u => String(u));

            res.render('modules/concesionarioCatalogo', {
                productos: data.productos,
                paginacion: {
                    paginaActual: page,
                    totalPaginas: Math.ceil(data.total / limit),
                    totalProductos: data.total
                },
                query: searchTerm,
                precio_min: precio_min,
                precio_max: precio_max,
                unidad_venta_seleccionada: unidad_venta,
                unidadesVenta: unidades
            });
        });
    });
};

exports.producto = (req, res) => {
    const sku = req.params.sku;
    concesionarioModel.obtenerProductoPorSku(sku, (err, producto) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error al cargar el producto');
        }
        if (!producto) {
            return res.status(404).send('Producto no encontrado');
        }

        // Reemplazar imagen por defecto "producto.png" por el logo de PPG
        if (producto.imagen === 'producto.png') {
            producto.imagen = '/img/ppg-logo.png';
        }

        // Crear array de imágenes para el carrusel (por ahora con una sola imagen)
        if (producto.imagen) {
            producto.imagenes = [producto.imagen];
        } else {
            producto.imagenes = ['/img/ppg-logo.png'];
        }

        res.render('modules/concesionarioProducto', { producto });
    });
};

exports.confirmarReserva = (req, res) => {
    res.render('modules/concesionarioConfirmarReserva');
};

exports.reservas = (req, res) => {
    res.render('modules/concesionarioReservas');
};

exports.detalleReserva = (req, res) => {
    res.render('modules/concesionarioDetalleReserva', {
        folio: req.params.folio
    });
};

exports.cancelarReserva = (req, res) => {
    res.render('modules/concesionarioCancelarReserva');
};