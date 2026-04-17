require('dotenv').config();
const dns = require('dns');
const { Pool, types } = require('pg');
const logger = require('../utils/logger');

// Forzar resolución IPv4 (Supabase resuelve a IPv6 por defecto en algunos sistemas)
dns.setDefaultResultOrder('ipv4first');

// Devolver DATE como string "YYYY-MM-DD" en vez de Date object (evita desfases de zona horaria)
types.setTypeParser(1082, (val) => val);
// Devolver TIMESTAMP como string en vez de Date object
types.setTypeParser(1114, (val) => val);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

pool.on('connect', () => {
    logger.info('Conectado a PostgreSQL (Supabase)');
});

pool.on('error', (err) => {
    logger.error('Error en pool de PostgreSQL:', err.message);
});

const db = {
    /**
     * Ejecuta una consulta SQL.
     * Convierte placeholders ? de MySQL al estilo $1, $2, ... de PostgreSQL.
     * El callback recibe (err, rows) donde rows es un array.
     * Para INSERT/UPDATE/DELETE, rows.affectedRows contiene el número de filas afectadas.
     */
    query(sql, params, callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }

        // Convertir ? al estilo $n de PostgreSQL
        let idx = 0;
        const pgSql = sql.replace(/\?/g, () => `$${++idx}`);

        pool.query(pgSql, params || [], (err, result) => {
            if (err) return callback(err);

            const rows = result.rows || [];
            rows.affectedRows = result.rowCount || 0;
            callback(null, rows);
        });
    },

    /**
     * Obtiene un cliente dedicado del pool para manejar transacciones.
     * callback(err, client, done) — llama a done() al terminar.
     */
    connect(callback) {
        pool.connect(callback);
    }
};

module.exports = db;
