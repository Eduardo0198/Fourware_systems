function generarFolioReserva() {
    const ahora = new Date();
    const yy = String(ahora.getFullYear()).slice(-2);
    const mm = String(ahora.getMonth() + 1).padStart(2, '0');
    const dd = String(ahora.getDate()).padStart(2, '0');
    const random = Math.random().toString(36).slice(2, 6).toUpperCase();

    return `PPG-${yy}${mm}${dd}-${random}`;
}

function calcularFechaLimiteCancelacion(minutos = 15) {
    const fecha = new Date();
    fecha.setMinutes(fecha.getMinutes() + minutos);
    return fecha;
}

function construirItemCarrito(producto, cantidad) {
    return {
        sku: producto.SKU,
        nombre: producto.nombre,
        imagen: producto.imagen || '/img/ppg-logo.png',
        precio: Number(producto.precio_unitario) || 0,
        cantidad,
        peso_unitario: Number(producto.peso_unitario) || 0,
        volumen_unitario: Number(producto.volumen_unitario) || 0
    };
}

function sincronizarCarritoConProducto(itemActual, producto) {
    return {
        ...itemActual,
        ...construirItemCarrito(producto, itemActual.cantidad)
    };
}

function obtenerCarritoActivo(req) {
    const cuentaActivaId = req.session.usuario?.cuentaActiva?.id_cuenta || null;

    if (req.session.carritoCuentaId && cuentaActivaId && req.session.carritoCuentaId !== cuentaActivaId) {
        req.session.carrito = [];
        req.session.carritoCuentaId = cuentaActivaId;
    }

    return req.session.carrito || [];
}

function obtenerCarritoActivoDesdeSesion(req) {
    return obtenerCarritoActivo(req);
}

function obtenerSkusDelCarrito(carrito = []) {
    return carrito
        .map((item) => String(item?.sku || '').trim())
        .filter(Boolean);
}

function vaciarCarritoActivoDesdeSesion(req) {
    req.session.carrito = [];
    return req.session.carrito;
}

function calcularResumenCarrito(carrito = []) {
    const subtotal = carrito.reduce((acc, producto) => acc + (producto.precio * producto.cantidad), 0);
    const totalPeso = carrito.reduce((acc, producto) => acc + ((producto.peso_unitario || 0) * producto.cantidad), 0);
    const totalVolumen = carrito.reduce((acc, producto) => acc + ((producto.volumen_unitario || 0) * producto.cantidad), 0);
    const iva = subtotal * 0.16;
    const total = subtotal + iva;

    return {
        subtotal,
        totalPeso,
        totalVolumen,
        iva,
        total
    };
}

function construirRedirectCatalogo(returnToRaw, sku) {
    const returnTo = String(returnToRaw || '/concesionario/catalogo').trim();
    const separador = returnTo.includes('?') ? '&' : '?';

    return `${returnTo}${separador}agregado=1&sku=${encodeURIComponent(sku)}`;
}

module.exports = {
    calcularFechaLimiteCancelacion,
    calcularResumenCarrito,
    construirItemCarrito,
    construirRedirectCatalogo,
    generarFolioReserva,
    obtenerCarritoActivo,
    obtenerCarritoActivoDesdeSesion,
    obtenerSkusDelCarrito,
    sincronizarCarritoConProducto,
    vaciarCarritoActivoDesdeSesion
};
