const express = require('express');
const path = require('path');
const helmet = require('helmet');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const logger = require('./utils/logger');
require('dotenv').config();
const app = express();

const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET || 'dev-only-change-me';
const PORT = Number(process.env.PORT || 3000);

if (isProduction) app.set('trust proxy', 1);

app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        maxAge: 15 * 60 * 1000,
        httpOnly: true,
        sameSite: 'lax',
        secure: isProduction
    }
}));
 
const campaniaModel = require('./models/campania.model');

app.use((req, res, next) => {
    res.locals.usuario = req.session.usuario || null;
    res.locals.mensaje = req.session.mensaje || null;
    res.locals.carritoCount = Array.isArray(req.session.carrito) ? req.session.carrito.length : 0;
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

app.listen(PORT, () => {
    logger.info(`Servidor corriendo en http://localhost:${PORT}`);
});
