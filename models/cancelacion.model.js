const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'cancelacion.config.json');
const DEFAULT_CONFIG = {
    minutos_cancelacion: 15
};

function normalizarMinutos(valor) {
    const minutos = parseInt(valor, 10);
    if (Number.isNaN(minutos) || minutos <= 0) {
        return null;
    }

    return minutos;
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
            const minutos = normalizarMinutos(parsed.minutos_cancelacion);

            callback(null, {
                minutos_cancelacion: minutos || DEFAULT_CONFIG.minutos_cancelacion
            });
        } catch (parseErr) {
            callback(parseErr);
        }
    });
}

exports.obtener = (callback) => {
    leerConfig(callback);
};

exports.actualizar = (minutosCancelacion, callback) => {
    const minutos = normalizarMinutos(minutosCancelacion);

    if (!minutos) {
        return callback(new Error('Minutos de cancelación inválidos.'));
    }

    const contenido = JSON.stringify({
        minutos_cancelacion: minutos
    }, null, 2);

    fs.writeFile(CONFIG_PATH, contenido, 'utf8', (err) => {
        if (err) {
            return callback(err);
        }

        callback(null, {
            minutos_cancelacion: minutos
        });
    });
};
