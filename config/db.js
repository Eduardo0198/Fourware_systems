require('dotenv').config();
const mysql = require('mysql2');
const logger = require('../utils/logger');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'feFOfe43?',
    database: process.env.DB_NAME || 'ElAvance4'
};

const conexion = mysql.createConnection(dbConfig);

conexion.connect((err) => {
    if (err) {
        logger.error('Error de conexion a MySQL:', err.message);
        logger.error(
            `Configuracion usada: ${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`
        );
        return;
    }

    logger.info(
        `Conectado a MySQL en ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`
    );
});

module.exports = conexion;
