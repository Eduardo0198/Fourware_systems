exports.dashboard = (req, res) => {
  res.render('dashboard');
};

exports.catalogo = (req, res) => {
  res.render('modules/adminCatalogo');
};

exports.campanas = (req, res) => {
  res.render('modules/adminCampanas');
};

exports.reportes = (req, res) => {
  res.render('modules/adminReportes');
};

exports.auditoria = (req, res) => {
  res.render('modules/adminAuditoria');
};

exports.registrarSKU = (req, res) => {
res.render('modules/catalogoRegistrar');
};

exports.modificarSKU = (req, res) => {
res.render('modules/catalogoModificar');
};

exports.cargaMasiva = (req, res) => {
res.render('modules/catalogoCargaMasiva');
};

exports.crearCampana = (req, res) => {
res.render('modules/campanaCrear');
};

exports.editarCampana = (req, res) => {
res.render('modules/campanaEditar');
};

exports.cancelacionCampana = (req, res) => {
res.render('modules/campanaCancelacion');
};

exports.estadoCampana = (req, res) => {
  res.render('modules/campanaEstado');
};