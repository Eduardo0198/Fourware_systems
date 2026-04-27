const XLSX = require('xlsx');
const reservaModel = require('../models/reserva.model');
const campaniaModel = require('../models/campania.model');
const cuentaModel = require('../models/cuenta.model');
const { registrarEvento } = require('../utils/auditoria.helper');
const logger = require('../utils/logger');

function formatearFechaInput(fecha) {
  return fecha.toISOString().slice(0, 10);
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
  // aqui creo el resumen y todo empieza en 0
  const resumen = {
    totalReservas: 0,
    totalProductos: 0,
    totalPeso: 0,
    totalVolumen: 0
  };

  // aqui guardo los folios para no repetir reservas
  const folios = [];

  // si detalle viene vacio, uso un arreglo vacio
  detalle = detalle || [];

  // aqui recorro uno por uno los datos del detalle
  detalle.forEach((item) => {
    // si el folio no existe todavia, lo agrego
    if (!folios.includes(item.folio)) {
      folios.push(item.folio);
    }

    // aqui cuento cuantas reservas diferentes hay
    resumen.totalReservas = folios.length;

    // aqui sumo la cantidad total de productos
    resumen.totalProductos += Number(item.cantidad || 0);

    // aqui sumo el peso total
    resumen.totalPeso += Number(item.peso_total_linea || 0);

    // aqui sumo el volumen total
    resumen.totalVolumen += Number(item.volumen_total_linea || 0);
  });

  // aqui regreso el resumen final
  return resumen;
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
// -- lau y eduardo ------21
function convertirReporteAExcel(detalle) {
  // aqui preparo las filas que van a ir en el excel
  const filas = [];

  detalle = detalle || [];

  // aqui recorro cada dato para dejarlo en un formato mas simple
  detalle.forEach((item) => {
    filas.push({
      Folio: item.folio,
      Fecha: item.fecha,
      Cuenta: item.cuenta,
      Distribuidor: item.distribuidor,
      Campania: item.campania,
      Producto: item.producto,
      Cantidad: item.cantidad,
      Direccion: item.direccion_entrega
    });
  });

  // aqui creo el libro y la hoja de excel
  const libro = XLSX.utils.book_new();
  const hoja = XLSX.utils.json_to_sheet(filas);

  // aqui agrego la hoja al libro
  XLSX.utils.book_append_sheet(libro, hoja, 'Reporte');

  // aqui regreso el archivo listo para descargar
  return XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' });
}
// lau y eduardo final helpers reporte operativo -- 21


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

  // ********************
  // Esta funcion pequeña evita repetir el render en varias partes del controlador
  // Recibe las reservas y los estados para mandar todo junto a la vista
  const renderReservasConfirmadas = (pageMessage, reservas, estadosLogisticos) => {
    // res.render carga la vista ejs que se va a mostrar en el navegador
    res.render('logistica/reservasConfirmadas', {
      // pageMessage es el mensaje que se muestra en la pantalla si hay error o aviso
      pageMessage,
      // filtros guarda las fechas que el usuario puso en el formulario
      filtros: {
        // fecha_inicio rellena el input de fecha inicio para que no se borre
        fecha_inicio: fechaInicio,
        // fecha_fin rellena el input de fecha fin para que no se borre
        fecha_fin: fechaFin
      },
      // reservas es la lista que se muestra en la tabla
      // Si no hay reservas, mando un arreglo vacio para que la vista no truene
      reservas: reservas || [],
      // resumen calcula los totales de importe, peso, volumen y cantidad de reservas
      resumen: construirResumenReservas(reservas || []),
      // estadosLogisticos son las opciones del select para cambiar el estado
      // Si no vienen estados, mando un arreglo vacio para evitar errores
      estadosLogisticos: estadosLogisticos || []
    });
  };
  // ****************************

  if (!esFechaInputValida(fechaInicio) || !esFechaInputValida(fechaFin) || fechaInicio > fechaFin) {
    return renderReservasConfirmadas({
        tipo: 'danger',
        texto: 'Debes seleccionar un periodo válido para consultar reservas confirmadas.'
      }, [], []);
  }

  // Primero consulto los estados para que el select de la vista tenga opciones
  reservaModel.obtenerEstadosLogisticos((estadosErr, estadosLogisticos) => {
    if (estadosErr) {
      logger.error(estadosErr);
      return renderReservasConfirmadas({
        tipo: 'danger',
        texto: 'No fue posible cargar los estados logisticos.'
      }, [], []);
    }

    reservaModel.obtenerReservasConfirmadasPorPeriodo(fechaInicio, fechaFin, (err, reservas) => {
      if (err) {
        logger.error(err);
        return renderReservasConfirmadas({
          tipo: 'danger',
          texto: 'No fue posible consultar las reservas confirmadas para el periodo seleccionado.'
        }, [], estadosLogisticos);
      }

      registrarEvento(req, 'Consulta de reservas confirmadas por periodo');
      renderReservasConfirmadas(reservas.length === 0 ? {
          tipo: 'warning',
          texto: 'No existen reservas confirmadas para el periodo seleccionado.'
        } : null,
        reservas || [],
        estadosLogisticos
      );
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
  
};

// **************************************
exports.actualizarEstadoLogistico = (req, res) => {
  // Aqui tomo el folio que viene en la URL de la ruta
  const folio = String(req.params.folio || '').trim();

  // Aqui convierto el estado nuevo a numero porque llega desde el formulario como texto
  const idEstadoNuevo = Number(req.body.id_estado_logistico);

  // Aqui guardo una observacion opcional por si logistica quiere explicar el cambio
  const observacion = String(req.body.observacion || '').trim();

  // Aqui tomo el correo del usuario que esta en sesion para guardar quien hizo el cambio
  const correoLogistica = req.session.usuario?.correo;

  // Aqui valido tres cosas antes de tocar la base de datos
  // 1 que el folio no venga vacio
  // 2 que el estado nuevo si sea un numero entero
  // 3 que el estado sea mayor a cero porque los estados empiezan en 1
  if (!folio || !Number.isInteger(idEstadoNuevo) || idEstadoNuevo < 1) {
    // req.session.mensaje guarda un mensaje temporal para mostrarlo despues del redirect
    // Lo uso porque al redirigir se carga otra vez la pagina de reservas
    req.session.mensaje = {
      // danger se usa para que el mensaje se vea como error
      tipo: 'danger',
      // texto es lo que vera el usuario en pantalla
      texto: 'No fue posible actualizar el estado logistico de la reserva.'
    };
    // res.redirect manda al usuario de regreso al listado de reservas confirmadas
    return res.redirect('/logistica/reservas-confirmadas');
  }

  // Primero busco la reserva para saber si existe y cual era su estado anterior
  reservaModel.obtenerReservaLogisticaPorFolio(folio, (reservaErr, rows) => {
    // reservaErr significa que hubo un problema al consultar la base de datos
    if (reservaErr) {
      // logger.error guarda el error en consola o logs para poder revisarlo como desarrollador
      logger.error(reservaErr);
      // Guardo un mensaje en sesion para avisar que fallo la consulta
      req.session.mensaje = {
        tipo: 'danger',
        texto: 'No fue posible consultar la reserva seleccionada.'
      };
      // Regreso al listado porque no puedo continuar sin la reserva
      return res.redirect('/logistica/reservas-confirmadas');
    }

    // Aqui preparo una variable vacia para guardar la reserva encontrada
    let reserva = null;

    // rows es el arreglo de resultados que regresa la base de datos
    // Si trae al menos una fila, tomo la primera porque el folio es unico
    if (rows && rows.length > 0) {
      reserva = rows[0];
    }

    // Si no hay reserva, no se actualiza nada porque puede estar cancelada o no existir
    if (!reserva) {
      req.session.mensaje = {
        tipo: 'warning',
        texto: 'La reserva seleccionada no existe o no esta confirmada.'
      };
      return res.redirect('/logistica/reservas-confirmadas');
    }

    // Aqui junto los datos que necesita el modelo para hacer el update y guardar historial
    const datosCambio = {
      folio,
      idEstadoAnterior: reserva.id_estado_logistico,
      idEstadoNuevo,
      observacion,
      correoLogistica
    };

    // Aqui mando los datos al modelo para que haga el cambio en la base de datos
    reservaModel.actualizarEstadoLogistico(datosCambio, (updateErr) => {
      // updateErr significa que algo fallo al actualizar la reserva o guardar el historial
      if (updateErr) {
        // Guardo el error en logs para poder revisarlo si algo sale mal
        // Los logs son importantes para entender que paso en el sistema sin afectar la experiencia del usuario
        logger.error(updateErr);
        // Guardo un mensaje temporal para mostrarlo cuando regrese al listado
        req.session.mensaje = {
          // danger indica que el mensaje es de error
          tipo: 'danger',
          // Este texto es el que vera el usuario de logistica
          texto: 'No fue posible guardar el nuevo estado logistico.'
        };
        // return hace que el controlador se detenga aqui y no siga ejecutando lo de abajo
        // res.redirect manda al usuario de regreso a la pantalla de reservas confirmadas
        return res.redirect('/logistica/reservas-confirmadas');
      }

      // Si no hubo error, registro el evento en la bitacora de auditoria
      // Uso el folio para saber que reserva fue modificada
      registrarEvento(req, `Actualizacion de estado logistico para reserva ${folio}`);
      // Guardo un mensaje temporal de exito para mostrarlo despues del redirect
      req.session.mensaje = {
        // success indica que el mensaje es positivo
        tipo: 'success',
        // Este texto confirma al usuario que el cambio se guardo
        texto: 'Estado logistico actualizado correctamente.'
      };
      // Regreso al listado para que el usuario vea nuevamente las reservas
      return res.redirect('/logistica/reservas-confirmadas');
    });
  });
};

// *************************

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

  // aqui valido que las fechas si tengan un valor correcto
  if (!esFechaInputValida(filtros.fechaInicio) || !esFechaInputValida(filtros.fechaFin) || filtros.fechaInicio > filtros.fechaFin) {
    return res.status(400).send('Las fechas del reporte no son validas.');
  }

  // aqui consulto el modelo para traer la informacion del reporte
  reservaModel.obtenerReporteOperativoLogistico(filtros, (err, detalle) => {
    if (err) {
      logger.error(err);
      return res.status(500).send('No se pudo consultar la informacion para exportar.');
    }

    // aqui reviso si el usuario pidio excel
    if (filtros.formato === 'xlsx') {
      // aqui convierto el detalle a excel
      const archivoExcel = convertirReporteAExcel(detalle);
      // aqui guardo un nombre sencillo para el archivo
      const nombreArchivo = `reporte_operativo_${filtros.fechaInicio}_${filtros.fechaFin}.xlsx`;

      // aqui registro que si se genero la exportacion
      registrarEvento(req, 'Exportacion de reporte operativo logístico en excel');

      // aqui mando el excel para que se descargue
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
      return res.send(archivoExcel);
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
