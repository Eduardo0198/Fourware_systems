const db = require('../config/db');

exports.guardarItem = (correo, sku, cantidad) => new Promise((resolve, reject) => {
    const query = `
        INSERT INTO "Carrito" (correo, "SKU", cantidad)
        VALUES (?, ?, ?)
        ON CONFLICT (correo, "SKU") DO UPDATE SET cantidad = EXCLUDED.cantidad
    `;
    db.query(query, [correo, sku, cantidad], (err) => err ? reject(err) : resolve());
});

exports.eliminarItem = (correo, sku) => new Promise((resolve, reject) => {
    db.query(`DELETE FROM "Carrito" WHERE correo = ? AND "SKU" = ?`, [correo, sku], (err) => err ? reject(err) : resolve());
});

exports.obtenerCarrito = (correo) => new Promise((resolve, reject) => {
    db.query(`SELECT "SKU", cantidad FROM "Carrito" WHERE correo = ?`, [correo], (err, rows) => err ? reject(err) : resolve(rows));
});

exports.limpiarCarrito = (correo) => new Promise((resolve, reject) => {
    db.query(`DELETE FROM "Carrito" WHERE correo = ?`, [correo], (err) => err ? reject(err) : resolve());
});
