const express = require('express');
const path = require('path');
const helmet = require('helmet');
const expressLayouts = require('express-ejs-layouts');
const app = express();

app.use(helmet({ contentSecurityPolicy: false }));

app.use(expressLayouts);
app.set('layout', 'layouts/main');

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/', require('./routes/auth.routes'));
app.use('/admin', require('./routes/admin.routes'));
app.use('/logistica', require('./routes/logistic.routes'));
app.use('/marketing', require('./routes/marketing.routes'));

const concesionarioRoutes = require('./routes/concesionario.routes');

app.use('/concesionario', concesionarioRoutes);

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:3000`);
});

app.use((req, res) => {
  res.status(404).send("Página no encontrada");
});