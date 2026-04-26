const path = require('path');
const logger = require('../utils/logger');

const BUCKET = 'productos';

async function subirImagenProducto(buffer, sku, mimetype) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey  = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !serviceKey) {
        throw new Error('SUPABASE_URL o SUPABASE_SERVICE_KEY no configurados.');
    }

    const ext      = mimetype === 'image/png' ? '.png' : mimetype === 'image/webp' ? '.webp' : '.jpg';
    const filename = `${sku}${ext}`;
    const url      = `${supabaseUrl}/storage/v1/object/${BUCKET}/${filename}`;

    const res = await fetch(url, {
        method:  'PUT',
        headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type':  mimetype,
            'x-upsert':      'true'
        },
        body: buffer
    });

    if (!res.ok) {
        const detail = await res.text().catch(() => res.status);
        throw new Error(`Supabase Storage error ${res.status}: ${detail}`);
    }

    return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${filename}`;
}

module.exports = { subirImagenProducto };
