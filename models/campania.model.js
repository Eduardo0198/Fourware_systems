const db = require('../config/db');

exports.obtenerCampaniaActiva = (callback) => {
    const query = `
        SELECT *
        FROM Campania
        WHERE estatus = 1
        LIMIT 1
    `;

    db.query(query, callback);
};