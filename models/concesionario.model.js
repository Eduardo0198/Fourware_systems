const db = require('../config/db');

exports.obtenerTopProductos = (callback) => {
    const query = `
        SELECT p.nombre_comercial, COUNT(r.SKU) AS total
        FROM Producto p
        JOIN Reserva_Producto r ON p.SKU = r.SKU
        GROUP BY p.nombre_comercial
        ORDER BY total DESC
        LIMIT 5
    `;
    db.query(query, callback);
};