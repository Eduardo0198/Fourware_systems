const db = require('../config/db');
const bcrypt = require('bcryptjs');
const logger = require('./logger');

const nuevaPassword = process.env.RESET_ALL_PASSWORD_TO;

const actualizar = async () => {
    if (!nuevaPassword) {
        logger.error('Define RESET_ALL_PASSWORD_TO para ejecutar este script.');
        process.exit(1);
    }

    const hash = await bcrypt.hash(nuevaPassword, 10);

    db.query(
        'UPDATE Usuario SET contrasenia = ?',
        [hash],
        (err) => {
            if (err) {
                logger.error(err);
                return;
            }

            logger.info('Contrasenias actualizadas para todos los usuarios.');
        }
    );
};

actualizar();
