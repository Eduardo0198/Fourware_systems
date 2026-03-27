const bitacoraModel = require('../models/bitacora.model');
const { registrarEvento } = require('../utils/auditoria.helper');

exports.dashboard = (req, res) => {
  // inicio caso 8 lau
  registrarEvento(req, 'Consulta de dashboard administrativo');
  // fin caso 8 lau
  res.render('dashboard');
};

exports.catalogo = (req, res) => {
  // inicio caso 8 lau
  registrarEvento(req, 'Consulta de catálogo administrativo');
  // fin caso 8 lau
  res.render('modules/adminCatalogo');
};

exports.campanas = (req, res) => {
  // inicio caso 8 lau
  registrarEvento(req, 'Consulta de configuración de campañas');
  // fin caso 8 lau
  res.render('modules/adminCampanas');
};

exports.reportes = (req, res) => {
  // inicio caso 8 lau
  registrarEvento(req, 'Consulta de reportes administrativos');
  // fin caso 8 lau
  res.render('modules/adminReportes');
};

// inicio caso 8 lau
exports.auditoria = (req, res) => {
  const usuario = req.session.usuario;
  const consultaSolicitada = req.query.consultar === '1';
  const correo = (req.query.usuario || '').trim();
  const fechaInicio = (req.query.fecha_inicio || '').trim();
  const fechaFin = (req.query.fecha_fin || '').trim();

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
    return renderAuditoria();
  }

  if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
    return renderAuditoria({
      estadoConsulta: 'error-validacion',
      mensaje: {
        tipo: 'warning',
        texto: 'El rango de fechas ingresado no es válido.'
      }
    });
  }

  bitacoraModel.obtenerRegistrosFiltrados(filtros, (err, registros) => {
    if (err) {
      registrarEvento(req, 'Error al consultar bitácora de auditoría', usuario ? usuario.correo : null);

      return renderAuditoria({
        estadoConsulta: 'error-consulta',
        mensaje: {
          tipo: 'danger',
          texto: 'No fue posible consultar la bitácora de auditoría. Intente nuevamente.'
        }
      });
    }

    const totalRegistros = registros.length;
    const accionConsulta = totalRegistros > 0
      ? 'Consulta de bitácora de auditoría'
      : 'Consulta de bitácora de auditoría sin resultados';

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
// fin caso 8 lau

exports.registrarSKU = (req, res) => {
// inicio caso 8 lau
registrarEvento(req, 'Consulta de registro de producto de catálogo');
// fin caso 8 lau
res.render('modules/catalogoRegistrar');
};

exports.modificarSKU = (req, res) => {
// inicio caso 8 lau
registrarEvento(req, 'Consulta de modificación de producto de catálogo');
// fin caso 8 lau
res.render('modules/catalogoModificar');
};

exports.cargaMasiva = (req, res) => {
// inicio caso 8 lau
registrarEvento(req, 'Consulta de carga masiva de productos');
// fin caso 8 lau
res.render('modules/catalogoCargaMasiva');
};

exports.crearCampana = (req, res) => {
// inicio caso 8 lau
registrarEvento(req, 'Consulta de creación de campaña');
// fin caso 8 lau
res.render('modules/campanaCrear');
};

exports.editarCampana = (req, res) => {
// inicio caso 8 lau
registrarEvento(req, 'Consulta de edición de campaña');
// fin caso 8 lau
res.render('modules/campanaEditar');
};

exports.cancelacionCampana = (req, res) => {
// inicio caso 8 lau
registrarEvento(req, 'Consulta de configuración de cancelación de reservas');
// fin caso 8 lau
res.render('modules/campanaCancelacion');
};

exports.estadoCampana = (req, res) => {
  // inicio caso 8 lau
  registrarEvento(req, 'Consulta de estado de campaña');
  // fin caso 8 lau
  res.render('modules/campanaEstado');
};
