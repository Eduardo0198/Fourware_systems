require('dotenv').config();
const mysql = require('mysql2');

const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ppg_preventa'
};

const conexion = mysql.createConnection(dbConfig);

conexion.connect((err) => {
    if (err) {
        console.error('Error de conexion a MySQL:', err.message);
        console.error(
            `Configuracion usada: ${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`
        );
        return;
    }

    console.log(
        `Conectado a MySQL en ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`
    );
});

module.exports = conexion;
