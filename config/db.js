require('dotenv').config();
const mysql = require('mysql2');

const conexion = mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ppg_preventa',
    port: Number(process.env.DB_PORT || 3306)
});

conexion.connect((err) => {
    if (err) {
        console.error('Error de conexion:', err);
        return;
    }
    console.log('Conectado a MySQL');
});

module.exports = conexion;
