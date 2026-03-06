const Marketing = require("../models/marketing.model");

exports.get_panel = (request, response) => {
  const modulos = Marketing.fetchAll();
  const modulo = request.params.modulo || "dashboard";
  const moduloValido = modulos.includes(modulo) ? modulo : "dashboard";

  response.render("marketing", {
    modulos,
    moduloActivo: moduloValido,
  });
};
