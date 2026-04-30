const ExcelJS = require('exceljs');
const reservaModel = require('../models/reserva.model');
const campaniaModel = require('../models/campania.model');
const cuentaModel = require('../models/cuenta.model');
const { registrarEvento } = require('../utils/auditoria.helper');
const logger = require('../utils/logger');
const renderError = require('../utils/renderError');

const FORMATOS_REPORTE_OPERATIVO = new Set(['csv', 'xlsx']);

function formatearFechaInput(fecha) {
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function obtenerRangoFechas(query) {
  const hoy = new Date();
  const hace30Dias = new Date();
  hace30Dias.setDate(hace30Dias.getDate() - 30);

  const fechaInicio = String(query.fecha_inicio || formatearFechaInput(hace30Dias)).trim();
  const fechaFin = String(query.fecha_fin || formatearFechaInput(hoy)).trim();

  return { fechaInicio, fechaFin };
}

function esFechaInputValida(valor) {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor);
}

function construirResumenReservas(reservas) {
  return (reservas || []).reduce((acc, reserva) => {
    acc.totalReservas += 1;
    acc.totalImporte += Number(reserva.total || 0);
    acc.totalPeso += Number(reserva.peso_total || 0);
    acc.totalVolumen += Number(reserva.volumen_total || 0);
    return acc;
  }, {
    totalReservas: 0,
    totalImporte: 0,
    totalPeso: 0,
    totalVolumen: 0
  });
}

function normalizarIdFiltro(valor) {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function obtenerFiltrosMetricas(query) {
  const { fechaInicio, fechaFin } = obtenerRangoFechas(query);
  const agruparPor = query.agrupar_por === 'cuenta' ? 'cuenta' : 'campania';

  return {
    fechaInicio,
    fechaFin,
    agruparPor,
    idCampania: normalizarIdFiltro(query.id_campania),
    idCuenta: normalizarIdFiltro(query.id_cuenta)
  };
}

function construirResumenMetricas(metricas) {
  return (metricas || []).reduce((acc, item) => {
    acc.totalReservas += Number(item.total_reservas || 0);
    acc.totalProductos += Number(item.total_productos || 0);
    acc.totalPeso += Number(item.peso_total || 0);
    acc.totalVolumen += Number(item.volumen_total || 0);
    acc.totalImporte += Number(item.importe_productos || 0);
    return acc;
  }, {
    totalReservas: 0,
    totalProductos: 0,
    totalPeso: 0,
    totalVolumen: 0,
    totalImporte: 0
  });
}


function construirFiltrosVista(filtros) {
  return {
    fecha_inicio: filtros.fechaInicio,
    fecha_fin: filtros.fechaFin,
    agrupar_por: filtros.agruparPor,
    id_campania: filtros.idCampania || '',
    id_cuenta: filtros.idCuenta || ''
  };
}

// lau y eduardo inicio helpers reporte operativo
function obtenerFiltrosReporte(query) {  // aqui uso la funcion de obtener rango de fechas para no repetir codigo
  const { fechaInicio, fechaFin } = obtenerRangoFechas(query); // aqui normalizo los filtros de campaña y cuenta para que si no vienen o son invalidos, se guarden como null

  return { // aqui regreso todos los filtros juntos
    fechaInicio, // fecha desde donde empieza la busqueda
    fechaFin, // fecha donde termina la busqueda
    idCampania: normalizarIdFiltro(query.id_campania), // id de la campaña si el usuario selecciono una
    idCuenta: normalizarIdFiltro(query.id_cuenta) // id de la cuenta si el usuario selecciono una
  };
}

function construirResumenReporte(detalle) {
  detalle = detalle || [];

  const folios = new Set();

  return detalle.reduce((acc, item) => {
    folios.add(item.folio);
    acc.totalReservas = folios.size;
    acc.totalLineas   = detalle.length;
    acc.totalProductos += Number(item.cantidad || 0);
    acc.totalPeso      += Number(item.peso_total_linea || 0);
    acc.totalVolumen   += Number(item.volumen_total_linea || 0);
    return acc;
  }, { totalReservas: 0, totalLineas: 0, totalProductos: 0, totalPeso: 0, totalVolumen: 0 });
}

function escaparValorCsv(valor) { // aqui convierto cualquier valor a texto
  let texto = String(valor || ''); // aqui reemplazo comillas dobles para que no se rompa el csv
  texto = texto.replace(/"/g, '""');  // aqui regreso el texto entre comillas
  return `"${texto}"`;
}

function convertirReporteACsv(detalle) { // aqui pongo los titulos del archivo csv
  const lineas = [
    [
      'Folio',
      'Fecha',
      'Cuenta',
      'Distribuidor',
      'Campania',
      'Producto',
      'Cantidad',
      'Direccion'
    ].join(',')
  ];
  // si no hay detalle, regreso solo los encabezados
  detalle = detalle || [];
  
  // aqui recorro cada fila y la convierto a texto csv
  detalle.forEach((item) => {
    const fila = [
      escaparValorCsv(item.folio),
      escaparValorCsv(item.fecha),
      escaparValorCsv(item.cuenta),
      escaparValorCsv(item.distribuidor),
      escaparValorCsv(item.campania),
      escaparValorCsv(item.producto),
      escaparValorCsv(item.cantidad),
      escaparValorCsv(item.direccion_entrega)
    ];

    lineas.push(fila.join(','));
  });

  // aqui uno todas las lineas para formar el csv final
  return lineas.join('\n');
}
async function convertirReporteAExcel(detalle, filtros) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PPG Preventa';
  wb.created = new Date();

  const ws = wb.addWorksheet('Reporte Operativo', {
    views: [{ state: 'frozen', ySplit: 5 }]
  });

  const AZUL_OSCURO = 'FF1E3A5F';
  const AZUL_ACENTO = 'FF2563EB';
  const FONDO_META  = 'FFE8EFF8';
  const LAST_COL    = 'H';

  const claves      = ['folio', 'fecha', 'cuenta', 'distribuidor', 'campania', 'producto', 'cantidad', 'direccion_entrega'];
  const encabezados = ['Folio', 'Fecha', 'Cuenta', 'Distribuidor', 'Campaña', 'Producto', 'Cantidad', 'Dirección de entrega'];

  const anchos = encabezados.map(h => h.length + 2);
  (detalle || []).forEach(r => {
    claves.forEach((k, i) => {
      const len = String(r[k] ?? '').length;
      if (len > anchos[i]) anchos[i] = len;
    });
  });
  ws.columns = claves.map((key, i) => ({
    key,
    width: Math.min(Math.max(anchos[i] + 4, 12), 52)
  }));

  // Fila 1: Título
  const fila1 = ws.addRow(['Reporte Operativo Logístico  ·  PPG']);
  ws.mergeCells(`A1:${LAST_COL}1`);
  Object.assign(fila1.getCell(1), {
    font:      { bold: true, size: 15, color: { argb: 'FFFFFFFF' } },
    fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_OSCURO } },
    alignment: { vertical: 'middle', horizontal: 'left', indent: 2 }
  });
  fila1.height = 34;

  // Filas 2-3: Metadatos
  [
    `Período:   ${filtros?.fechaInicio || ''}  →  ${filtros?.fechaFin || ''}`,
    `Generado:  ${new Date().toLocaleString('es-MX')}`
  ].forEach((texto, idx) => {
    const num  = idx + 2;
    const fila = ws.addRow([texto]);
    ws.mergeCells(`A${num}:${LAST_COL}${num}`);
    Object.assign(fila.getCell(1), {
      fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: FONDO_META } },
      font:      { size: 10, color: { argb: AZUL_OSCURO }, italic: idx === 1 },
      alignment: { vertical: 'middle', horizontal: 'left', indent: 2 }
    });
    fila.height = 17;
  });

  // Fila 4: Separador
  const filaSep = ws.addRow(['']);
  ws.mergeCells(`A4:${LAST_COL}4`);
  filaSep.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_ACENTO } };
  filaSep.height = 5;

  // Fila 5: Encabezados
  const filaEnc = ws.addRow(encabezados);
  filaEnc.height = 22;
  filaEnc.eachCell({ includeEmpty: true }, cell => {
    cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_OSCURO } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border    = { bottom: { style: 'medium', color: { argb: AZUL_ACENTO } } };
  });

  // Filas de datos
  (detalle || []).forEach((item, idx) => {
    const fila = ws.addRow([
      item.folio, item.fecha, item.cuenta, item.distribuidor,
      item.campania, item.producto, Number(item.cantidad), item.direccion_entrega
    ]);
    const bg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF1F5F9';
    fila.eachCell({ includeEmpty: true }, cell => {
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.alignment = { vertical: 'middle' };
    });
    fila.getCell(7).numFmt = '0';
  });

  // Fila de totales
  const primerDato = 6;
  const ultimoDato = 5 + (detalle || []).length;
  const filaTot = ws.addRow([
    'TOTALES', '', '', '', '', `${(detalle || []).length} fila(s)`,
    (detalle || []).length > 0 ? { formula: `SUM(G${primerDato}:G${ultimoDato})` } : 0,
    ''
  ]);
  filaTot.height = 20;
  filaTot.eachCell({ includeEmpty: true }, cell => {
    cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_OSCURO } };
    cell.alignment = { vertical: 'middle' };
  });
  filaTot.getCell(7).numFmt = '0';

  return wb.xlsx.writeBuffer();
}


function construirContextoMetricas(query, campaniaActiva) {
  // aqui reutilizo la funcion que ya tenias para sacar fecha inicial y final
  const { fechaInicio, fechaFin } = obtenerRangoFechas(query);

  // aqui leo si el usuario mando una campania en la URL o en el formulario
  // si no viene o viene invalida, normalizarIdFiltro regresa null
  const idCampaniaSolicitada = normalizarIdFiltro(query.id_campania);

  // aqui hago lo mismo pero con la cuenta
  // esto me sirve para que luego podamos filtrar por cuenta si se necesita
  const idCuenta = normalizarIdFiltro(query.id_cuenta);

  // aqui decido si debo usar la campania activa como valor por default
  // si el usuario ya eligio una campania, entonces no uso la activa
  // si no eligio nada, entonces tomo la campania activa que venga del modelo
  const campaniaBase = idCampaniaSolicitada
    ? null : (campaniaActiva || null);

  // aqui saco el id de campania final que voy a usar en las consultas
  // primero intento usar la campania que selecciono el usuario
  // si no existe, intento usar la campania activa
  // si tampoco hay campania activa, se queda en null
  const idCampania = idCampaniaSolicitada || (campaniaBase ? Number(campaniaBase.id_campania) : null);

  // aqui regreso un solo objeto con todo el contexto de la consulta
  // esto ayuda a no andar pasando variables sueltas por todos lados
  return {
    // fecha desde donde se van a consultar las metricas
    fechaInicio,

    // fecha hasta donde se van a consultar las metricas
    fechaFin,

    // id de campania real que se usara en los queries
    idCampania,

    // id de cuenta si el usuario quiere filtrar por una cuenta especifica
    idCuenta,

    // aqui mantengo la logica actual de agrupacion
    // si el usuario pide cuenta, agrupa por cuenta
    // en cualquier otro caso se agrupa por campania
    agruparPor: query.agrupar_por === 'cuenta' ? 'cuenta' : 'campania',

    // aqui guardo una bandera para saber si la pantalla esta usando
    // la campania activa automaticamente y no una elegida manualmente
    usaCampaniaActivaPorDefault: !idCampaniaSolicitada && !!campaniaBase,

    // aqui regreso el objeto completo de la campania activa
    // esto despues sirve para mostrar su nombre, fechas o estado en la vista
    campaniaActiva: campaniaBase
  };
}




function cargarCatalogosMetricas(callback) {
  campaniaModel.obtenerTodas((errCampanias, campanias) => {
    if (errCampanias) return callback(errCampanias);

    cuentaModel.obtenerTodas((errCuentas, cuentas) => {
      if (errCuentas) return callback(errCuentas);
      callback(null, { campanias: campanias || [], cuentas: cuentas || [] });
    });
  });
}

exports.reservasConfirmadas = (req, res) => {
  const { fechaInicio, fechaFin } = obtenerRangoFechas(req.query);

  if (!esFechaInputValida(fechaInicio) || !esFechaInputValida(fechaFin) || fechaInicio > fechaFin) {
    return res.render('logistica/reservasConfirmadas', {
      pageMessage: {
        tipo: 'danger',
        texto: 'Debes seleccionar un periodo válido para consultar reservas confirmadas.'
      },
      filtros: {
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin
      },
      reservas: [],
      resumen: construirResumenReservas([])
    });
  }

  reservaModel.obtenerReservasConfirmadasPorPeriodo(fechaInicio, fechaFin, (err, reservas) => {
    if (err) {
      logger.error(err);
      return res.render('logistica/reservasConfirmadas', {
        pageMessage: {
          tipo: 'danger',
          texto: 'No fue posible consultar las reservas confirmadas para el periodo seleccionado.'
        },
        filtros: {
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin
        },
        reservas: [],
        resumen: construirResumenReservas([])
      });
    }

    registrarEvento(req, 'Consulta de reservas confirmadas por periodo');
    res.render('logistica/reservasConfirmadas', {
      pageMessage: reservas.length === 0 ? {
        tipo: 'warning',
        texto: 'No existen reservas confirmadas para el periodo seleccionado.'
      } : null,
      filtros: {
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin
      },
      reservas: reservas || [],
      resumen: construirResumenReservas(reservas)
    });
  });
};

exports.metricas = (req, res) => {
  const filtros = obtenerFiltrosMetricas(req.query);

  const renderMetricas = (pageMessage, metricas, serieTiempo, catalogos) => res.render('logistica/metricas', {
    pageMessage,
    filtros: construirFiltrosVista(filtros),
    metricas: metricas || [],
    serieTiempo: serieTiempo || [],
    resumen: construirResumenMetricas(metricas),
    campanias: catalogos.campanias,
    cuentas: catalogos.cuentas
  });

  cargarCatalogosMetricas((catalogosErr, catalogos) => {
    const catalogosVista = catalogos || { campanias: [], cuentas: [] };

    if (catalogosErr) {
      logger.error(catalogosErr);
      return renderMetricas({
        tipo: 'danger',
        texto: 'No fue posible cargar los filtros de campaña y cuenta.'
      }, [], [], catalogosVista);
    }

    if (!esFechaInputValida(filtros.fechaInicio) || !esFechaInputValida(filtros.fechaFin) || filtros.fechaInicio > filtros.fechaFin) {
      return renderMetricas({
        tipo: 'danger',
        texto: 'Debes seleccionar un periodo válido para consultar métricas logísticas.'
      }, [], [], catalogosVista);
    }

    reservaModel.obtenerMetricasLogisticasConsolidadas(filtros, (err, metricas) => {
      if (err) {
        logger.error(err);
        return renderMetricas({
          tipo: 'danger',
          texto: 'No fue posible consultar las métricas logísticas consolidadas.'
        }, [], [], catalogosVista);
      }

      reservaModel.obtenerSerieTiempoMetricasLogisticas(filtros, (serieErr, serieTiempo) => {
        if (serieErr) {
          logger.error(serieErr);
          return renderMetricas({
            tipo: 'danger',
            texto: 'No fue posible consultar la serie temporal de metricas logisticas.'
          }, metricas || [], [], catalogosVista);
        }

        registrarEvento(req, 'Consulta de metricas logisticas consolidadas');
        renderMetricas(metricas.length === 0 ? {
          tipo: 'warning',
          texto: 'No existen reservas confirmadas con los filtros seleccionados.'
        } : null, metricas, serieTiempo, catalogosVista);
      });
    });
  });
};

exports.reporteOperativo = (req, res) => {
  const filtros = obtenerFiltrosReporte(req.query);
  const filtrosVista = {
    fecha_inicio: filtros.fechaInicio,
    fecha_fin: filtros.fechaFin,
    id_campania: filtros.idCampania || '',
    id_cuenta: filtros.idCuenta || ''
  };

  const renderReporte = (pageMessage, detalle, catalogos) => res.render('logistica/reporteOperativo', {
    pageMessage,
    filtros: filtrosVista,
    detalle: detalle || [],
    resumen: construirResumenReporte(detalle),
    campanias: catalogos.campanias,
    cuentas: catalogos.cuentas
  });

  cargarCatalogosMetricas((catalogosErr, catalogos) => {
    const catalogosVista = catalogos || { campanias: [], cuentas: [] };

    if (catalogosErr) {
      logger.error(catalogosErr);
      return renderReporte({
        tipo: 'danger',
        texto: 'No fue posible cargar los filtros de campaña y cuenta.'
      }, [], catalogosVista);
    }

    if (!esFechaInputValida(filtros.fechaInicio) || !esFechaInputValida(filtros.fechaFin) || filtros.fechaInicio > filtros.fechaFin) {
      return renderReporte({
        tipo: 'danger',
        texto: 'Debes seleccionar un periodo válido para generar el reporte operativo.'
      }, [], catalogosVista);
    }

    reservaModel.obtenerReporteOperativoLogistico(filtros, (err, detalle) => {
      if (err) {
        logger.error(err);
        registrarEvento(req, 'Error al consultar reporte operativo logístico');
        return renderReporte({
          tipo: 'danger',
          texto: 'No fue posible generar el reporte operativo. Intente nuevamente.'
        }, [], catalogosVista);
      }

      registrarEvento(req, 'Consulta de reporte operativo logístico');
      return renderReporte(detalle.length === 0 ? {
        tipo: 'warning',
        texto: 'No existen reservas confirmadas con los criterios seleccionados.'
      } : null, detalle, catalogosVista);
    });
  });
};


exports.metricas = (req, res) => {
  // aqui primero consulto la campania activa
  // esto sirve para que, si el usuario no manda una campania,
  // la pantalla use por default la campania activa del sistema
  campaniaModel.obtenerCampaniaActiva((campaniaErr, campaniaRows) => {
    // aqui convierto el resultado en un solo objeto
    // si no hay campania activa, se queda como null
    const campaniaActiva = Array.isArray(campaniaRows) && campaniaRows.length > 0
      ? campaniaRows[0]
      : null;

    // aqui construyo el contexto final de filtros
    // esta funcion decide fechas, cuenta y campania real a usar
    const filtros = construirContextoMetricas(req.query, campaniaActiva);

    // aqui centralizo el render de la vista para no repetir codigo
    // ahora agrego rendimientoProductos porque ya lo vamos a mandar a la vista
    const renderMetricas = (pageMessage, metricas, serieTiempo, rendimientoProductos, catalogos) => res.render('logistica/metricas', {
      // mensaje superior por si hay errores o warnings
      pageMessage,

      // filtros ya listos para que la vista los vuelva a pintar en el formulario
      filtros: construirFiltrosVista(filtros),

      // metricas generales agrupadas por campania o cuenta
      metricas: metricas || [],

      // serie temporal para comportamiento en el tiempo
      serieTiempo: serieTiempo || [],

      // nuevo arreglo con rendimiento por producto dentro de la campania
      rendimientoProductos: rendimientoProductos || [],

      // resumen global que ya tenias de peso, volumen, reservas e importe
      resumen: construirResumenMetricas(metricas),

      // catalogos para selects
      campanias: catalogos.campanias,
      cuentas: catalogos.cuentas,

      // contexto extra para que luego podamos decir en la vista
      // si se esta usando la campania activa automaticamente
      campaniaActiva: filtros.campaniaActiva,
      usaCampaniaActivaPorDefault: filtros.usaCampaniaActivaPorDefault
    });

    // si falla la consulta de campania activa, la registro,
    // pero no detengo la pantalla completa
    if (campaniaErr) {
      logger.error(campaniaErr);
    }

    // aqui cargo catalogos de campanias y cuentas
    cargarCatalogosMetricas((catalogosErr, catalogos) => {
      // si algo falla, dejo objetos vacios para evitar que truene la vista
      const catalogosVista = catalogos || { campanias: [], cuentas: [] };

      // si no pude cargar catalogos, regreso la vista con error
      if (catalogosErr) {
        logger.error(catalogosErr);
        return renderMetricas({
          tipo: 'danger',
          texto: 'No fue posible cargar los filtros de campania y cuenta.'
        }, [], [], [], catalogosVista);
      }

      // aqui valido que las fechas sean correctas antes de consultar
      if (!esFechaInputValida(filtros.fechaInicio) || !esFechaInputValida(filtros.fechaFin) || filtros.fechaInicio > filtros.fechaFin) {
        return renderMetricas({
          tipo: 'danger',
          texto: 'Debes seleccionar un periodo valido para consultar metricas logisticas.'
        }, [], [], [], catalogosVista);
      }

      // aqui consulto las metricas generales que ya tenias
      reservaModel.obtenerMetricasLogisticasConsolidadas(filtros, (err, metricas) => {
        // si falla esta consulta, ya no puedo seguir con la pantalla
        if (err) {
          logger.error(err);
          return renderMetricas({
            tipo: 'danger',
            texto: 'No fue posible consultar las metricas logisticas consolidadas.'
          }, [], [], [], catalogosVista);
        }

        // aqui consulto la serie temporal
        reservaModel.obtenerSerieTiempoMetricasLogisticas(filtros, (serieErr, serieTiempo) => {
          // si falla la serie temporal, muestro error y dejo vacia esa parte
          if (serieErr) {
            logger.error(serieErr);
            return renderMetricas({
              tipo: 'danger',
              texto: 'No fue posible consultar la serie temporal de metricas logisticas.'
            }, metricas || [], [], [], catalogosVista);
          }

          // aqui consulto el rendimiento por producto dentro de la campania
          // este es el bloque nuevo de este paso
          reservaModel.obtenerRendimientoProductosCampania(filtros, (productosErr, rendimientoProductos) => {
            // si falla esta consulta, no trueno toda la pantalla
            // pero si aviso que el bloque de productos no pudo generarse
            if (productosErr) {
              logger.error(productosErr);
              return renderMetricas({
                tipo: 'danger',
                texto: 'No fue posible consultar el rendimiento por producto.'
              }, metricas || [], serieTiempo || [], [], catalogosVista);
            }

            // aqui registro la consulta en bitacora
            registrarEvento(req, 'Consulta de metricas logisticas consolidadas');

            // si no hay metricas generales, mando warning
            // si si hay, mando la vista normal con todos los datos
            return renderMetricas(metricas.length === 0 ? {
              tipo: 'warning',
              texto: 'No existen reservas confirmadas con los filtros seleccionados.'
            } : null, metricas, serieTiempo, rendimientoProductos, catalogosVista);
          });
        });
      });
    });
  });
};



// lau y eduardo inicio exportar reporte operativo cu-18
exports.exportarReporteOperativo = (req, res) => {
  // aqui leo las fechas que llegan del formulario
  const fecha_inicio = String(req.body.fecha_inicio || '').trim(); // aqui normalizo las fechas para que si no vienen o son invalidas, se guarden como vacias
  const fecha_fin = String(req.body.fecha_fin || '').trim();

  // aqui leo la campaña, la cuenta y el formato
  const id_campania = req.body.id_campania;
  const id_cuenta = req.body.id_cuenta;
  // aqui leo el formato que llega del formulario
  let formato = req.body.formato || '';
  // aqui le quito espacios por si viene algo raro
  formato = String(formato).trim();
  // aqui lo paso a minusculas para compararlo mas facil
  formato = formato.toLowerCase();

  
  // aqui junto todo en un solo objeto para usarlo mas facil
  const filtros = {};
  filtros.fechaInicio = fecha_inicio;
  filtros.fechaFin = fecha_fin;
  filtros.idCampania = normalizarIdFiltro(id_campania);
  filtros.idCuenta = normalizarIdFiltro(id_cuenta);
  filtros.formato = formato;

  if (!FORMATOS_REPORTE_OPERATIVO.has(filtros.formato)) {
    registrarEvento(req, 'Intento de exportacion de reporte operativo con formato no valido');
    return res.status(400).send('El formato de exportacion seleccionado no es valido.');
  }

  // aqui valido que las fechas si tengan un valor correcto
  if (!esFechaInputValida(filtros.fechaInicio) || !esFechaInputValida(filtros.fechaFin) || filtros.fechaInicio > filtros.fechaFin) {
    return res.status(400).send('Las fechas del reporte no son validas.');
  }

  // aqui consulto el modelo para traer la informacion del reporte
  reservaModel.obtenerReporteOperativoLogistico(filtros, (err, detalle) => {
    if (err) {
      logger.error(err);
      return renderError(res, 500, 'No se pudo consultar la información para exportar.', '/logistica/reservas-confirmadas');
    }

    // aqui reviso si el usuario pidio excel
    if (filtros.formato === 'xlsx') {
      const nombreArchivo = `reporte_operativo_${filtros.fechaInicio}_${filtros.fechaFin}.xlsx`;
      convertirReporteAExcel(detalle, filtros)
        .then(buffer => {
          registrarEvento(req, 'Exportacion de reporte operativo logístico en excel');
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
          return res.send(Buffer.from(buffer));
        })
        .catch(err => {
          logger.error(err);
          return renderError(res, 500, 'Error al generar el archivo Excel.', '/logistica/reporte-operativo');
        });
      return;
    }

    // aqui convierto el detalle a formato csv
    const csv = convertirReporteACsv(detalle);
    // aqui guardo un nombre sencillo para el archivo
    const nombreArchivo = `reporte_operativo_${filtros.fechaInicio}_${filtros.fechaFin}.csv`;

    // aqui registro que si se genero la exportacion
    registrarEvento(req, 'Exportacion de reporte operativo logístico en csv');

    // aqui mando el archivo para que se descargue
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    return res.send('\uFEFF' + csv);
  });
};
// lau y eduardo final exportar reporte operativo cu-18
