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

exports.insertarProductos = (productos, folio, callback) => {
    if (!Array.isArray(productos) || productos.length === 0) {
        return callback(null);
    }

    let pendientes = productos.length;
    let terminado = false;

    productos.forEach((producto) => {
        const subtotalLinea = Number(producto.precio) * Number(producto.cantidad);

        db.query(`
            INSERT INTO Reserva_Producto 
            (folio, SKU, cantidad, precio_aplicado, subtotal_linea)
            VALUES (?, ?, ?, ?, ?)
        `, [
            folio,
            producto.sku,
            producto.cantidad,
            producto.precio,
            subtotalLinea
        ], (err) => {
            if (terminado) {
                return;
            }

            if (err) {
                terminado = true;
                return callback(err);
            }

            pendientes -= 1;

            if (pendientes === 0) {
                terminado = true;
                callback(null);
            }
        });
    });
};
