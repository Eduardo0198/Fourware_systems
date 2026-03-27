const db = require('../config/db');

exports.obtenerCampaniaActiva = (callback) => {
    const query = `
        SELECT *
        FROM Campania
        WHERE estatus = 1
        ORDER BY fecha_inicio ASC, id_campania ASC
        LIMIT 1
    `;

    db.query(query, callback);
};

exports.obtenerTodas = (callback) => {
    const query = `
        SELECT *
        FROM Campania
        ORDER BY fecha_inicio DESC, id_campania DESC
    `;

    db.query(query, callback);
};

exports.obtenerPorId = (idCampania, callback) => {
    const query = `
        SELECT *
        FROM Campania
        WHERE id_campania = ?
        LIMIT 1
    `;

    db.query(query, [idCampania], (err, rows) => {
        if (err) {
            return callback(err);
        }

        callback(null, rows.length ? rows[0] : null);
    });
};

exports.obtenerSeleccionablesParaCatalogo = (callback) => {
    const query = `
        SELECT *
        FROM Campania
        WHERE fecha_fin >= CURDATE()
        ORDER BY estatus DESC, fecha_inicio DESC, id_campania DESC
    `;

    db.query(query, callback);
};

exports.crear = (campania, callback) => {
    const query = `
        INSERT INTO Campania (nombre, fecha_inicio, fecha_fin, banner, estatus)
        VALUES (?, ?, ?, ?, ?)
    `;

    db.query(query, [
        campania.nombre,
        campania.fecha_inicio,
        campania.fecha_fin,
        campania.banner,
        campania.estatus
    ], callback);
};

exports.actualizar = (idCampania, campania, callback) => {
    const query = `
        UPDATE Campania
        SET nombre = ?, fecha_inicio = ?, fecha_fin = ?, banner = ?, estatus = ?
        WHERE id_campania = ?
    `;

    db.query(query, [
        campania.nombre,
        campania.fecha_inicio,
        campania.fecha_fin,
        campania.banner,
        campania.estatus,
        idCampania
    ], callback);
};

exports.existeOtraCampaniaActiva = (idCampania, callback) => {
    const query = `
        SELECT COUNT(*) AS total
        FROM Campania
        WHERE estatus = 1 AND id_campania <> ?
    `;

    db.query(query, [idCampania], (err, rows) => {
        if (err) {
            return callback(err);
        }

        callback(null, Number(rows[0].total) > 0);
    });
};

exports.existeConflictoPeriodo = (fechaInicio, fechaFin, idCampaniaExcluir, callback) => {
    const excluir = Number.isInteger(idCampaniaExcluir) ? idCampaniaExcluir : 0;
    const query = `
        SELECT COUNT(*) AS total
        FROM Campania
        WHERE id_campania <> ?
          AND fecha_inicio <= ?
          AND fecha_fin >= ?
    `;

    db.query(query, [excluir, fechaFin, fechaInicio], (err, rows) => {
        if (err) {
            return callback(err);
        }

        callback(null, Number(rows[0].total) > 0);
    });
};

exports.activarExclusiva = (idCampania, callback) => {
    db.beginTransaction((err) => {
        if (err) {
            return callback(err);
        }

        db.query(
            'UPDATE Campania SET estatus = 0 WHERE id_campania <> ? AND estatus = 1',
            [idCampania],
            (errReset) => {
                if (errReset) {
                    return db.rollback(() => callback(errReset));
                }

                db.query(
                    'UPDATE Campania SET estatus = 1 WHERE id_campania = ?',
                    [idCampania],
                    (errActivate, result) => {
                        if (errActivate) {
                            return db.rollback(() => callback(errActivate));
                        }

                        db.commit((errCommit) => {
                            if (errCommit) {
                                return db.rollback(() => callback(errCommit));
                            }

                            callback(null, result);
                        });
                    }
                );
            }
        );
    });
};

exports.desactivar = (idCampania, callback) => {
    const query = `
        UPDATE Campania
        SET estatus = 0
        WHERE id_campania = ?
    `;

    db.query(query, [idCampania], callback);
};
