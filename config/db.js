const mysql = require('mysql2');
const conexion = mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'VIery2006@',
    database: 'ppg_preventa'
});

conexion.connect((err) => {
    if (err) {
        console.error('Error de conexion:', err);
        return;
    }
    console.log('Conectado a MySQL');
});

module.exports = conexion;