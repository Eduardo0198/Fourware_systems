const Usuario = require('../models/usuario.model');

exports.get_login = (request, response, next) => {
  response.render('login', { error: '' });
};

exports.post_login = (request, response, next) => {
  const user = Usuario.validar(request.body.usuario, request.body.password);

  if (!user) {
    return response.render('login', { error: 'Completa usuario y contraseña' });
  }

  response.redirect('/marketing/dashboard');
};

exports.get_logout = (request, response, next) => {
  response.redirect('/');
};
