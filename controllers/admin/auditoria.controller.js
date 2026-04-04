const { bitacoraModel, registrarEvento } = require('./shared');

exports.auditoria = (req, res) => {
    const usuario = req.session.usuario;
    const consultaSolicitada = req.query.consultar === '1';
    const correo = String(req.query.usuario || '').trim();
    const fechaInicio = String(req.query.fecha_inicio || '').trim();
    const fechaFin = String(req.query.fecha_fin || '').trim();
    const filtros = {
        correo,
        fechaInicio,
        fechaFin
    };

    const renderAuditoria = (datosExtra = {}) => {
        res.render('modules/adminAuditoria', {
            filtros,
            registros: [],
            totalRegistros: 0,
            estadoConsulta: 'inicial',
            ...datosExtra
        });
    };

    if (!consultaSolicitada) {
        return bitacoraModel.listarRecientes((err, registros) => {
            if (err) {
                registrarEvento(
                    req,
                    'Error al consultar bitacora de auditoria',
                    usuario ? usuario.correo : null
                );

                return renderAuditoria({
                    estadoConsulta: 'error-consulta',
                    mensaje: {
                        tipo: 'danger',
                        texto: 'No fue posible cargar la bitacora de auditoria. Intente nuevamente.'
                    }
                });
            }

            registrarEvento(req, 'Consulta de bitacora de auditoria', usuario ? usuario.correo : null);

            return renderAuditoria({
                registros,
                totalRegistros: registros.length,
                estadoConsulta: registros.length > 0 ? 'con-resultados' : 'sin-resultados',
                mensaje: registros.length > 0
                    ? {
                        tipo: 'info',
                        texto: 'Se muestran los registros mas recientes de la bitacora.'
                    }
                    : {
                        tipo: 'info',
                        texto: 'No hay registros disponibles en la bitacora.'
                    }
            });
        });
    }

    if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
        return renderAuditoria({
            estadoConsulta: 'error-validacion',
            mensaje: {
                tipo: 'warning',
                texto: 'El rango de fechas ingresado no es valido.'
            }
        });
    }

    bitacoraModel.obtenerRegistrosFiltrados(filtros, (err, registros) => {
        if (err) {
            registrarEvento(
                req,
                'Error al consultar bitacora de auditoria',
                usuario ? usuario.correo : null
            );

            return renderAuditoria({
                estadoConsulta: 'error-consulta',
                mensaje: {
                    tipo: 'danger',
                    texto: 'No fue posible consultar la bitacora de auditoria. Intente nuevamente.'
                }
            });
        }

        const totalRegistros = registros.length;
        const accionConsulta = totalRegistros > 0
            ? 'Consulta de bitacora de auditoria'
            : 'Consulta de bitacora de auditoria sin resultados';

        registrarEvento(req, accionConsulta, usuario ? usuario.correo : null);

        if (totalRegistros === 0) {
            return renderAuditoria({
                estadoConsulta: 'sin-resultados',
                mensaje: {
                    tipo: 'info',
                    texto: 'No se encontraron registros con los criterios seleccionados.'
                }
            });
        }

        return renderAuditoria({
            registros,
            totalRegistros,
            estadoConsulta: 'con-resultados',
            mensaje: {
                tipo: 'success',
                texto: `Se encontraron ${totalRegistros} registro(s) para los criterios seleccionados.`
            }
        });
    });
};
