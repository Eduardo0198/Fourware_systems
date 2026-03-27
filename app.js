const express = require('express');
const path = require('path');
const helmet = require('helmet');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
require('dotenv').config()
const app = express();

app.use(session({
    secret: 'secreto_super_seguro',
    resave: false,
    saveUninitialized: false
}));

const campaniaModel = require('./models/campania.model');

app.use((req, res, next) => {
    res.locals.usuario = req.session.usuario || null;
    res.locals.mensaje = req.session.mensaje || null;
    delete req.session.mensaje;

    campaniaModel.obtenerCampaniaActiva((err, result) => {
        res.locals.campania = (result && result.length > 0) ? result[0] : null;
        next();
    });
});

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
app.use('/concesionario', require('./routes/concesionario.routes'));
app.use('/concesionario/carrito', require('./routes/carrito.routes'));

app.use((req, res) => {
    res.status(404).send("Página no encontrada");
});

const PORT = process.env.PORT;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
