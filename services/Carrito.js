const { construirItemCarrito, sincronizarCarritoConProducto } = require('./carrito.service');

class Carrito {
    constructor(items = [], cuentaActivaId = null) {
        this._items = Array.isArray(items) ? [...items] : [];
        this._cuentaActivaId = cuentaActivaId;
    }

    existeProducto(sku) {
        return this._items.findIndex(p => p.sku === sku);
    }

    actualizarCantidad(index, producto, cantidadNumerica) {
        this._items[index] = sincronizarCarritoConProducto(this._items[index], producto);
        this._items[index].cantidad += cantidadNumerica;
    }

    agregarProducto(item) {
        this._items.push(item);
    }

    toArray() {
        return this._items;
    }
}

module.exports = Carrito;
