const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const projectRoot = path.join(__dirname, '..');
const logoPath = path.join(projectRoot, 'public', 'img', 'ppg-logo.png');

const AZUL       = '#123c73';
const AZUL_CLARO = '#e8f0fb';
const GRIS_TEXTO = '#374151';
const GRIS_SUAVE = '#6b7280';
const BORDE      = '#d1d5db';
const FONDO_CARD = '#f9fafb';
const BLANCO     = '#ffffff';

function obtenerRutaImagen(imagen) {
    if (!imagen || typeof imagen !== 'string' || !imagen.startsWith('/')) return null;
    const ruta = path.join(projectRoot, 'public', imagen.replace(/^\/+/, ''));
    return fs.existsSync(ruta) ? ruta : null;
}

function textoAlineadoDerecha(doc, texto, x, y, anchoColumna) {
    const anchoTexto = doc.widthOfString(texto);
    doc.text(texto, x + anchoColumna - anchoTexto, y);
}

function dibujarFilaInfo(doc, etiqueta, valor, x, y, anchoEtiqueta, anchoValor) {
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(GRIS_SUAVE)
       .text(etiqueta, x, y, { width: anchoEtiqueta, lineBreak: false });
    doc.font('Helvetica').fontSize(10).fillColor(GRIS_TEXTO)
       .text(valor, x + anchoEtiqueta + 8, y, { width: anchoValor });
    const altoValor = doc.heightOfString(valor, { width: anchoValor });
    return Math.max(altoValor, 14) + 10;
}

function generarPdfReserva(res, reserva) {
    const doc = new PDFDocument({ size: 'A4', margin: 0 });

    const nombreArchivo = `reserva-${reserva.folio}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    doc.pipe(res);

    const PW     = 595.28;
    const M      = 44;
    const ANCHO  = PW - M * 2;

    // ── HEADER ──────────────────────────────────────────────────────────
    doc.rect(0, 0, PW, 88).fill(AZUL);

    if (fs.existsSync(logoPath)) {
        doc.image(logoPath, M, 14, { fit: [60, 60] });
    }

    doc.font('Helvetica-Bold').fontSize(22).fillColor(BLANCO)
       .text('Comprobante de reserva', M + 76, 20, { lineBreak: false });
    doc.font('Helvetica').fontSize(10).fillColor('rgba(255,255,255,0.75)')
       .text('Sistema de preventa Fourware Systems', M + 76, 48, { lineBreak: false });

    doc.font('Helvetica').fontSize(8.5).fillColor('rgba(255,255,255,0.6)')
       .text('Folio', PW - M - 140, 20, { width: 140, align: 'right', lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(BLANCO)
       .text(reserva.folio, PW - M - 140, 34, { width: 140, align: 'right', lineBreak: false });

    // ── SECCIÓN INFO + TOTALES ───────────────────────────────────────────
    let y = 108;

    const COL_INFO_W  = 300;
    const GAP         = 18;
    const COL_TOT_X   = M + COL_INFO_W + GAP;
    const COL_TOT_W   = ANCHO - COL_INFO_W - GAP;
    const ETIQ_W      = 130;
    const VAL_INFO_W  = COL_INFO_W - ETIQ_W - 8;

    const filas = [
        ['Fecha',                 reserva.fechaTexto             || 'No disponible'],
        ['Estatus',               reserva.estatusTexto           || 'No disponible'],
        ['Sucursal',              reserva.fechaSucursalTexto     || 'Sin sucursal registrada'],
        ['Dirección',             reserva.direccionSucursal      || 'Sin dirección registrada'],
        ['Límite de cancelación', reserva.fechaCancelacionTexto  || 'No disponible'],
    ];

    let yInfo = y;
    filas.forEach(([etiqueta, valor]) => {
        yInfo += dibujarFilaInfo(doc, etiqueta, valor, M, yInfo, ETIQ_W, VAL_INFO_W);
    });

    // Caja de totales
    const TOT_H = 108;
    doc.roundedRect(COL_TOT_X, y, COL_TOT_W, TOT_H, 10)
       .fillAndStroke(AZUL_CLARO, BORDE);

    doc.font('Helvetica-Bold').fontSize(12).fillColor(AZUL)
       .text('Totales', COL_TOT_X + 14, y + 12, { lineBreak: false });

    doc.moveTo(COL_TOT_X + 14, y + 30)
       .lineTo(COL_TOT_X + COL_TOT_W - 14, y + 30)
       .strokeColor(BORDE).lineWidth(0.8).stroke();

    const renderLinea = (etiq, valor, yL) => {
        doc.font('Helvetica').fontSize(10).fillColor(GRIS_TEXTO)
           .text(etiq, COL_TOT_X + 14, yL, { lineBreak: false });
        textoAlineadoDerecha(doc, valor, COL_TOT_X + 14, yL, COL_TOT_W - 28);
    };

    renderLinea('Subtotal:', `$${Number(reserva.subtotal || 0).toFixed(2)}`, y + 38);
    renderLinea('IVA (16%):', `$${Number(reserva.iva || 0).toFixed(2)}`, y + 54);

    doc.moveTo(COL_TOT_X + 14, y + 71)
       .lineTo(COL_TOT_X + COL_TOT_W - 14, y + 71)
       .strokeColor(BORDE).lineWidth(0.8).stroke();

    doc.font('Helvetica-Bold').fontSize(11).fillColor(AZUL)
       .text('Total:', COL_TOT_X + 14, y + 79, { lineBreak: false });
    textoAlineadoDerecha(
        doc.font('Helvetica-Bold').fontSize(11).fillColor(AZUL),
        `$${Number(reserva.total || 0).toFixed(2)}`,
        COL_TOT_X + 14, y + 79, COL_TOT_W - 28
    );

    y = Math.max(yInfo, y + TOT_H) + 20;

    // Separador
    doc.moveTo(M, y).lineTo(PW - M, y).strokeColor(BORDE).lineWidth(0.8).stroke();
    y += 16;

    // ── PRODUCTOS ────────────────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(13).fillColor(AZUL)
       .text('Productos reservados', M, y);
    y += 20;

    (reserva.productos || []).forEach((producto) => {
        if (y > 680) { doc.addPage(); y = M; }

        const CARD_H = 86;
        const IMG_AREA = 64;

        doc.roundedRect(M, y, ANCHO, CARD_H, 8)
           .fillAndStroke(FONDO_CARD, BORDE);

        const rutaImg = obtenerRutaImagen(producto.imagen);
        if (rutaImg) {
            doc.image(rutaImg, M + 10, y + 10, { fit: [IMG_AREA - 8, CARD_H - 20], align: 'center', valign: 'center' });
        } else {
            doc.font('Helvetica').fontSize(8).fillColor(GRIS_SUAVE)
               .text('Sin imagen', M + 4, y + CARD_H / 2 - 6, { width: IMG_AREA });
        }

        const TX = M + IMG_AREA + 14;
        const nombre = producto.nombre_comercial || producto.nombre || 'Producto sin nombre';

        doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827')
           .text(nombre, TX, y + 12, { width: 210, lineBreak: false });
        doc.font('Helvetica').fontSize(9.5).fillColor(GRIS_SUAVE)
           .text(`SKU: ${producto.SKU || producto.sku}`, TX, y + 30, { lineBreak: false });
        doc.text(`Cantidad: ${producto.cantidad}`, TX, y + 44, { lineBreak: false });

        const PX    = PW - M - 14;
        const PCOL  = 118;
        const pxL   = PX - PCOL;

        doc.font('Helvetica').fontSize(9).fillColor(GRIS_SUAVE)
           .text('Precio unit.', pxL, y + 12, { width: PCOL, align: 'right', lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(10).fillColor(GRIS_TEXTO)
           .text(`$${Number(producto.precio_aplicado || producto.precioAplicado || 0).toFixed(2)}`, pxL, y + 26, { width: PCOL, align: 'right', lineBreak: false });
        doc.font('Helvetica').fontSize(9).fillColor(GRIS_SUAVE)
           .text('Subtotal', pxL, y + 48, { width: PCOL, align: 'right', lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(11).fillColor(AZUL)
           .text(`$${Number(producto.subtotal_linea || producto.subtotalLinea || 0).toFixed(2)}`, pxL, y + 61, { width: PCOL, align: 'right', lineBreak: false });

        y += CARD_H + 10;
    });

    // ── FOOTER ───────────────────────────────────────────────────────────
    y += 10;
    doc.moveTo(M, y).lineTo(PW - M, y).strokeColor(BORDE).lineWidth(0.5).stroke();
    doc.font('Helvetica').fontSize(8.5).fillColor(GRIS_SUAVE)
       .text(
           'Este documento funciona como comprobante informativo de la reserva generada en el sistema.',
           M, y + 10, { width: ANCHO, align: 'center' }
       );

    doc.end();
}

module.exports = { generarPdfReserva };
