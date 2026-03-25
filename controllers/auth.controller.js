const authService = require('../services/auth.service');
const { serializeCookie } = require('../utils/cookie.util');

exports.login = (req, res) => {
  const reason = req.query.reason;
  const pageMessage =
    reason === 'session-expired'
      ? {
          type: 'warning',
          text: 'Tu sesion ya no esta vigente. Inicia sesion nuevamente.',
        }
      : null;

  res.render('login', {
    layout: false,
    pageMessage,
  });
};

exports.doLogin = (req, res) => {
  const result = authService.login({
    email: String(req.body.email || '').trim(),
    password: String(req.body.password || '').trim(),
    ipAddress: req.ip,
  });

  if (!result.success) {
    return res.status(400).render('login', {
      layout: false,
      pageMessage: {
        type: 'danger',
        text: result.message,
      },
    });
  }

  res.setHeader(
    'Set-Cookie',
    serializeCookie('admin_session', result.session.token, {
      httpOnly: true,
      maxAge: 8 * 60 * 60,
      path: '/',
      sameSite: 'Lax',
    })
  );

  return res.redirect('/admin/dashboard');
};

exports.logout = (req, res) => {
  if (req.sessionToken) {
    authService.logout(req.sessionToken, req.ip);
  }

  res.setHeader(
    'Set-Cookie',
    serializeCookie('admin_session', '', {
      httpOnly: true,
      maxAge: 0,
      path: '/',
      sameSite: 'Lax',
    })
  );

  return res.redirect('/');
};
