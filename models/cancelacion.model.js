const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'cancelacion.config.json');
const DEFAULT_CONFIG = {
    horas_cancelacion: 24
};

function normalizarHoras(valor) {
    const horas = parseInt(valor, 10);
    if (Number.isNaN(horas) || horas <= 0) {
        return null;
    }

    return horas;
}

function leerConfig(callback) {
    fs.readFile(CONFIG_PATH, 'utf8', (err, contenido) => {
        if (err) {
            if (err.code === 'ENOENT') {
                return callback(null, { ...DEFAULT_CONFIG });
            }

            return callback(err);
        }

        try {
            const parsed = JSON.parse(contenido);
            const horas = normalizarHoras(parsed.horas_cancelacion);

            callback(null, {
                horas_cancelacion: horas || DEFAULT_CONFIG.horas_cancelacion
            });
        } catch (parseErr) {
            callback(parseErr);
        }
    });
}

exports.obtener = (callback) => {
    leerConfig(callback);
};

exports.actualizar = (horasCancelacion, callback) => {
    const horas = normalizarHoras(horasCancelacion);

    if (!horas) {
        return callback(new Error('Horas de cancelación inválidas.'));
    }

    const contenido = JSON.stringify({
        horas_cancelacion: horas
    }, null, 2);

    fs.writeFile(CONFIG_PATH, contenido, 'utf8', (err) => {
        if (err) {
            return callback(err);
        }

        callback(null, {
            horas_cancelacion: horas
        });
    });
};
