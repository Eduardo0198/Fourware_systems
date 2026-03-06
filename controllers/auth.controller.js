exports.login = (req, res) => {
  res.render('login');
};

exports.doLogin = (req, res) => {

  const email = String(req.body.email || '').trim();
  const password = String(req.body.password || '').trim();

  if (!email || !password) {
    return res.redirect('/');
  }

  res.redirect('/admin/dashboard');
};