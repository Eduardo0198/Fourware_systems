const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

let nodemailer = null;

try {
    nodemailer = require('nodemailer');
} catch (error) {
    nodemailer = null;
}

const projectRoot = path.join(__dirname, '..');
const templatePath = path.join(projectRoot, 'views', 'emails', 'reservaConfirmada.ejs');

function obtenerConfiguracionCorreo() {
    const host = process.env.SMTP_HOST || '';
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
    const user = process.env.SMTP_USER || '';
    const pass = process.env.SMTP_PASS || '';
    const fromEmail = process.env.SMTP_FROM_EMAIL || user;
    const fromName = process.env.SMTP_FROM_NAME || 'Fourware Systems';
    const appBaseUrl = process.env.APP_BASE_URL || '';

    return {
        host,
        port,
        secure,
        user,
        pass,
        fromEmail,
        fromName,
        appBaseUrl
    };
}

function correoDisponible(config) {
    return Boolean(
        nodemailer &&
        config.host &&
        config.port &&
        config.user &&
        config.pass &&
        config.fromEmail
    );
}

function crearTransporter(config) {
    return nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
            user: config.user,
            pass: config.pass
        }
    });
}

function normalizarRutaImagen(imagen) {
    if (!imagen || typeof imagen !== 'string') {
        return null;
    }

    if (imagen.startsWith('http://') || imagen.startsWith('https://')) {
        return { url: imagen, path: null };
    }

    const rutaRelativa = imagen.replace(/^\/+/, '');
    const rutaAbsoluta = path.join(projectRoot, 'public', rutaRelativa);

    if (fs.existsSync(rutaAbsoluta)) {
        return { url: null, path: rutaAbsoluta };
    }

    return { url: null, path: null };
}

function construirAdjuntosYProductos(productos, appBaseUrl = '') {
    const attachments = [];
    const productosCorreo = productos.map((producto, index) => {
        const imagen = normalizarRutaImagen(producto.imagen);

        if (imagen?.path) {
            const cid = `producto-${index}@fourware`;
            attachments.push({
                filename: path.basename(imagen.path),
                path: imagen.path,
                cid
            });

            return {
                ...producto,
                imagenSrc: `cid:${cid}`
            };
        }

        if (imagen?.url) {
            return {
                ...producto,
                imagenSrc: imagen.url
            };
        }

        if (appBaseUrl && producto.imagen && producto.imagen.startsWith('/')) {
            return {
                ...producto,
                imagenSrc: `${appBaseUrl}${producto.imagen}`
            };
        }

        return {
            ...producto,
            imagenSrc: null
        };
    });

    return {
        attachments,
        productosCorreo
    };
}

async function renderizarPlantillaReserva(reserva, appBaseUrl) {
    const { attachments, productosCorreo } = construirAdjuntosYProductos(reserva.productos, appBaseUrl);
    const html = await ejs.renderFile(templatePath, {
        reserva: {
            ...reserva,
            productos: productosCorreo
        }
    });

    return { html, attachments };
}

async function enviarCorreoReservaConfirmada({ destinatario, reserva }) {
    const config = obtenerConfiguracionCorreo();

    if (!correoDisponible(config)) {
        return {
            enviado: false,
            omitido: true,
            motivo: 'Correo no configurado o nodemailer no instalado.'
        };
    }

    const transporter = crearTransporter(config);
    const { html, attachments } = await renderizarPlantillaReserva(reserva, config.appBaseUrl);

    await transporter.sendMail({
        from: `${config.fromName} <${config.fromEmail}>`,
        to: destinatario,
        subject: `Confirmación de reserva ${reserva.folio}`,
        html,
        attachments
    });

    return {
        enviado: true,
        omitido: false
    };
}

module.exports = {
    enviarCorreoReservaConfirmada
};
