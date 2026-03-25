const db = require('../config/db');
const bcrypt = require('bcryptjs');

const nuevaPassword = 'Ppg2025!';

const actualizar = async () => {

    const hash = await bcrypt.hash(nuevaPassword, 10);

    db.query(
        'UPDATE Usuario SET contrasenia = ?',
        [hash],
        (err) => {
            if (err) {
                console.log(err);
                return;
            }

            console.log('Contraseñas actualizadas');
            console.log('Password para todos: Ppg2025!');
        }
    );
};

actualizar();