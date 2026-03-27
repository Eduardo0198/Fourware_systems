const db = require('../config/db');

exports.crearReservaConProductos = (data, productos, callback) => {
    db.beginTransaction((transactionErr) => {
        if (transactionErr) {
            return callback(transactionErr);
        }

        const reservaQuery = `
            INSERT INTO Reserva
            (folio, estatus, fecha, subtotal, iva, total, fecha_cancelacion_reserva, correo, id_cuenta, id_sucursal)
            VALUES (?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, ?)
        `;

        db.query(reservaQuery, [
            data.folio,
            data.estatus,
            data.subtotal,
            data.iva,
            data.total,
            data.fecha_cancelacion_reserva,
            data.correo,
            data.id_cuenta,
            data.id_sucursal
        ], (reservaErr) => {
            if (reservaErr) {
                return db.rollback(() => callback(reservaErr));
            }

            if (!Array.isArray(productos) || productos.length === 0) {
                return db.rollback(() => callback(new Error('No hay productos para registrar en la reserva.')));
            }

            const productoQuery = `
                INSERT INTO Reserva_Producto
                (folio, SKU, cantidad, precio_aplicado, subtotal_linea)
                VALUES (?, ?, ?, ?, ?)
            `;

            let pendientes = productos.length;
            let fallo = false;

            productos.forEach((producto) => {
                db.query(productoQuery, [
                    data.folio,
                    producto.sku,
                    producto.cantidad,
                    producto.precio,
                    producto.precio * producto.cantidad
                ], (productoErr) => {
                    if (fallo) {
                        return;
                    }

                    if (productoErr) {
                        fallo = true;
                        return db.rollback(() => callback(productoErr));
                    }

                    pendientes -= 1;

                    if (pendientes === 0) {
                        db.commit((commitErr) => {
                            if (commitErr) {
                                return db.rollback(() => callback(commitErr));
                            }

                            return callback(null);
                        });
                    }
                });
            });
        });
    });
};
