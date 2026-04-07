require('dotenv').config();
const mysql = require('mysql2');
const logger = require('../utils/logger');

const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || ''
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
