const express = require('express');
const app = express();

const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', 'views');

const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));

const authRoutes = require('./routes/auth.routes');
const marketingRoutes = require('./routes/marketing.routes');

app.use('/', authRoutes);
app.use('/marketing', marketingRoutes);

app.use((request, response, next) => {
  response.status(404).send('La ruta no existe');
});

app.listen(3000);
