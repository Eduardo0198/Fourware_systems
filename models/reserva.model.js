const db = require('../config/db');
exports.crearReserva = (data, callback) => {
    const query = `
        INSERT INTO Reserva 
        (folio, fecha, subtotal, iva, total, correo, id_sucursal)
        VALUES (?, NOW(), ?, ?, ?, ?, ?)
    `;
    db.query(query, [
        data.folio,
        data.subtotal,
        data.iva,
        data.total,
        data.correo,
        data.id_sucursal
    ], callback);
};

exports.insertarProductos = (productos, folio) => {
    productos.forEach(p => {
        db.query(`
            INSERT INTO Reserva_Producto 
            (folio, sku, cantidad, precio, subtotal)
            VALUES (?, ?, ?, ?, ?)
        `, [
            folio,
            p.sku,
            p.cantidad,
            p.precio,
            p.precio * p.cantidad
        ]);
    });
};