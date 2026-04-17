const reservaModel = require('../../models/reserva.model');
const productoModel = require('../../models/producto.model');
const campaniaModel = require('../../models/campania.model');
const { registrarEvento } = require('./shared');
const logger = require('../../utils/logger');

function formatearFecha(valor) {
    if (!valor) return '—';
    try {
        const d = new Date(String(valor).includes('T') ? valor : valor + 'T12:00:00');
        return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (_) { return String(valor); }
}

exports.dashboard = (req, res) => res.redirect('/admin/inicio');

exports.inicio = (req, res) => {
    registrarEvento(req, 'Consulta de inicio administrativo');

    let resumen = { total: 0, confirmadas: 0, canceladas: 0 };
    let productosTotal = 0;
    let campania = null;
    let reservasRecientes = [];
    let pendientes = 4;

    function intentarRender() {
        pendientes -= 1;
        if (pendientes > 0) return;

        res.render('adminInicio', {
            saludo: usuario.nombre.split(' ')[0],
            resumen,
            productosTotal,
            campania,
            reservasRecientes
        });
    }

    const usuario = req.session.usuario;

    reservaModel.obtenerResumenAdministrativo((err, rows) => {
        if (!err && rows && rows[0]) {
            resumen = {
                total:       Number(rows[0].total       || 0),
                confirmadas: Number(rows[0].confirmadas || 0),
                canceladas:  Number(rows[0].canceladas  || 0)
            };
        } else if (err) logger.error(err);
        intentarRender();
    });

    productoModel.contarProductos((err, rows) => {
        if (!err && rows && rows[0]) productosTotal = Number(rows[0].total || 0);
        else if (err) logger.error(err);
        intentarRender();
    });

    campaniaModel.obtenerCampaniaActiva((err, rows) => {
        if (!err && rows && rows.length > 0) campania = rows[0];
        else if (err) logger.error(err);
        intentarRender();
    });

    reservaModel.obtenerReservasRecientesAdmin(8, (err, rows) => {
        if (!err && Array.isArray(rows)) {
            reservasRecientes = rows.map(r => ({
                ...r,
                fechaTexto:   formatearFecha(r.fecha),
                totalTexto:   Number(r.total || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }),
                estatusTexto: Number(r.estatus) === 1 ? 'Confirmada' : 'Cancelada',
                estatusClase: Number(r.estatus) === 1 ? 'success' : 'secondary'
            }));
        } else if (err) logger.error(err);
        intentarRender();
    });
};
