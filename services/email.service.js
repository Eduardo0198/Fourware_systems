const path = require('path');
const ejs = require('ejs');

let sgMail = null;

try {
    sgMail = require('@sendgrid/mail');
    if (process.env.SENDGRID_API_KEY) {
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    }
} catch (error) {
    sgMail = null;
}

const projectRoot = path.join(__dirname, '..');
const templatePath = path.join(projectRoot, 'views', 'emails', 'reservaConfirmada.ejs');

function correoDisponible() {
    return Boolean(
        sgMail &&
        process.env.SENDGRID_API_KEY &&
        process.env.SENDGRID_FROM_EMAIL
    );
}

async function renderizarPlantillaReserva(reserva) {
    const rawBase = (process.env.APP_BASE_URL || '').replace(/\/$/, '');
    const appBaseUrl = rawBase && !rawBase.includes('localhost') && !rawBase.includes('127.0.0.1')
        ? rawBase
        : '';
    const productosCorreo = reserva.productos.map((producto) => {
        const img = producto.imagen;
        let imagenSrc = null;
        if (img?.startsWith('http')) {
            imagenSrc = img;
        } else if (img?.startsWith('/') && appBaseUrl) {
            imagenSrc = `${appBaseUrl}${img}`;
        }
        return { ...producto, imagenSrc };
    });

    const html = await ejs.renderFile(templatePath, {
        reserva: { ...reserva, productos: productosCorreo },
        urlDetalle: appBaseUrl ? `${appBaseUrl}/concesionario/reserva/${reserva.folio}` : null
    });

    return html;
}

async function enviarCorreoReservaConfirmada({ destinatario, reserva }) {
    if (!correoDisponible()) {
        return {
            enviado: false,
            omitido: true,
            motivo: 'SendGrid no configurado.'
        };
    }

    const html = await renderizarPlantillaReserva(reserva);

    await sgMail.send({
        to: destinatario,
        from: {
            email: process.env.SENDGRID_FROM_EMAIL,
            name: process.env.SENDGRID_FROM_NAME || 'Fourware Systems'
        },
        subject: `Confirmación de reserva ${reserva.folio}`,
        html
    });

    return {
        enviado: true,
        omitido: false
    };
}

module.exports = {
    enviarCorreoReservaConfirmada
};
