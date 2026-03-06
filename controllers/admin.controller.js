exports.dashboard = (req, res) => {
  res.render('dashboard');
};

exports.catalogo = (req, res) => {
  res.render('modules/adminCatalogo');
};

exports.campanas = (req, res) => {
  res.render('modules/adminCampanas');
};