const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const projectRoot = path.join(__dirname, '..');
const logoPath = path.join(projectRoot, 'public', 'img', 'ppg-logo.png');

function obtenerRutaImagen(imagen) {
    if (!imagen || typeof imagen !== 'string' || !imagen.startsWith('/')) {
        return null;
    }

    const ruta = path.join(projectRoot, 'public', imagen.replace(/^\/+/, ''));
    return fs.existsSync(ruta) ? ruta : null;
}

function escribirFilaEtiquetaValor(doc, etiqueta, valor, y) {
    doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('#111827')
        .text(etiqueta, 50, y)
        .font('Helvetica')
        .text(valor, 220, y, { width: 320 });
}

function escribirTotales(doc, reserva, y) {
    doc
        .roundedRect(360, y - 8, 180, 82, 12)
        .fillAndStroke('#f3f4f6', '#d1d5db')
        .fillColor('#111827');

    doc.font('Helvetica-Bold').fontSize(12).text('Totales', 376, y + 4);
    doc.font('Helvetica').fontSize(11);
    doc.text(`Subtotal: $${Number(reserva.subtotal || 0).toFixed(2)}`, 376, y + 24);
    doc.text(`IVA: $${Number(reserva.iva || 0).toFixed(2)}`, 376, y + 42);
    doc.font('Helvetica-Bold').text(`Total: $${Number(reserva.total || 0).toFixed(2)}`, 376, y + 60);
}

function escribirProductos(doc, productos, yInicial) {
    let y = yInicial;

    doc.font('Helvetica-Bold').fontSize(14).fillColor('#111827').text('Productos reservados', 50, y);
    y += 26;

    (productos || []).forEach((producto, index) => {
        if (y > 690) {
            doc.addPage();
            y = 50;
        }

        doc
            .roundedRect(50, y, 495, 92, 12)
            .fillAndStroke('#ffffff', '#d1d5db')
            .fillColor('#111827');

        const rutaImagen = obtenerRutaImagen(producto.imagen);

        if (rutaImagen) {
            doc.image(rutaImagen, 62, y + 10, {
                fit: [68, 68],
                align: 'center',
                valign: 'center'
            });
        } else {
            doc
                .rect(62, y + 10, 68, 68)
                .strokeColor('#d1d5db')
                .stroke()
                .font('Helvetica')
                .fontSize(9)
                .fillColor('#6b7280')
                .text('Sin imagen', 72, y + 38);
        }

        const nombre = producto.nombre_comercial || producto.nombre || 'Producto sin nombre';

        doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827').text(nombre, 145, y + 12, {
            width: 250
        });
        doc.font('Helvetica').fontSize(10).fillColor('#374151');
        doc.text(`SKU: ${producto.SKU || producto.sku}`, 145, y + 34);
        doc.text(`Cantidad: ${producto.cantidad}`, 145, y + 50);
        doc.text(`Precio: $${Number(producto.precio_aplicado || producto.precioAplicado || 0).toFixed(2)}`, 300, y + 34);
        doc.text(`Subtotal: $${Number(producto.subtotal_linea || producto.subtotalLinea || 0).toFixed(2)}`, 300, y + 50);

        y += index === (productos.length - 1) ? 104 : 102;
    });

    return y;
}

function generarPdfReserva(res, reserva) {
    const doc = new PDFDocument({
        size: 'A4',
        margin: 50
    });

    const nombreArchivo = `reserva-${reserva.folio}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);

    doc.pipe(res);

    if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 30, { fit: [72, 72] });
    }

    doc
        .font('Helvetica-Bold')
        .fontSize(24)
        .fillColor('#123c73')
        .text('Comprobante de reserva', 140, 42);

    doc
        .font('Helvetica')
        .fontSize(11)
        .fillColor('#4b5563')
        .text('Sistema de preventa Fourware Systems', 140, 74);

    doc
        .moveTo(50, 118)
        .lineTo(545, 118)
        .strokeColor('#d1d5db')
        .stroke();

    escribirFilaEtiquetaValor(doc, 'Folio', reserva.folio, 140);
    escribirFilaEtiquetaValor(doc, 'Fecha', reserva.fechaTexto || 'No disponible', 160);
    escribirFilaEtiquetaValor(doc, 'Estatus', reserva.estatusTexto || 'No disponible', 180);
    escribirFilaEtiquetaValor(doc, 'Sucursal', reserva.fechaSucursalTexto || 'Sin sucursal registrada', 200);
    escribirFilaEtiquetaValor(doc, 'Dirección', reserva.direccionSucursal || 'Sin dirección registrada', 220);
    escribirFilaEtiquetaValor(doc, 'Límite de cancelación', reserva.fechaCancelacionTexto || 'No disponible', 240);

    escribirTotales(doc, reserva, 146);

    const siguienteY = escribirProductos(doc, reserva.productos || [], 290);

    doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#6b7280')
        .text(
            'Este documento funciona como comprobante informativo de la reserva generada en el sistema.',
            50,
            Math.min(siguienteY + 8, 760),
            { width: 495, align: 'center' }
        );

    doc.end();
}

module.exports = {
    generarPdfReserva
};
