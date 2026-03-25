const auditService = require('../services/audit.service');
const campaignService = require('../services/campaign.service');
const productService = require('../services/product.service');

function renderCatalogRegister(res, options = {}) {
  res.render('modules/catalogoRegistrar', {
    pageMessage: options.pageMessage || null,
    formData: options.formData || {},
    ...productService.getRegistrationContext(),
  });
}

function renderCampaignCreate(res, options = {}) {
  res.render('modules/campanaCrear', {
    pageMessage: options.pageMessage || null,
    formData: options.formData || {},
  });
}

exports.dashboard = (req, res) => {
  res.render('dashboard', campaignService.getDashboardData());
};

exports.catalogo = (req, res) => {
  res.render('modules/adminCatalogo', productService.getRegistrationContext());
};

exports.campanas = (req, res) => {
  res.render('modules/adminCampanas', {
    campaigns: campaignService.listCampaigns(),
    summary: campaignService.getCampaignSummaryCards(),
  });
};

exports.reportes = (req, res) => {
  res.render('modules/adminReportes', campaignService.getDashboardData());
};

exports.auditoria = (req, res) => {
  res.render('modules/adminAuditoria', {
    logs: auditService.listEntries(),
  });
};

exports.registrarSKU = (req, res) => {
  renderCatalogRegister(res);
};

exports.registrarSKUPost = (req, res) => {
  const result = productService.registerProduct(req.body, {
    userEmail: req.currentUser.email,
    ipAddress: req.ip,
  });

  if (!result.success) {
    return renderCatalogRegister(res, {
      formData: req.body,
      pageMessage: {
        type: 'danger',
        text: result.message,
      },
    });
  }

  return renderCatalogRegister(res, {
    pageMessage: {
      type: 'success',
      text: result.message,
    },
  });
};

exports.modificarSKU = (req, res) => {
  res.render('modules/catalogoModificar');
};

exports.cargaMasiva = (req, res) => {
  res.render('modules/catalogoCargaMasiva');
};

exports.crearCampana = (req, res) => {
  renderCampaignCreate(res);
};

exports.crearCampanaPost = (req, res) => {
  const result = campaignService.createCampaign(req.body, {
    userEmail: req.currentUser.email,
    ipAddress: req.ip,
  });

  if (!result.success) {
    return renderCampaignCreate(res, {
      formData: req.body,
      pageMessage: {
        type: 'danger',
        text: result.message,
      },
    });
  }

  return renderCampaignCreate(res, {
    pageMessage: {
      type: 'success',
      text: result.message,
    },
  });
};

exports.editarCampana = (req, res) => {
  res.render('modules/campanaEditar', {
    campaigns: campaignService.listCampaigns(),
  });
};

exports.editarCampanaPost = (req, res) => {
  const result = campaignService.updateCampaign(req.params.id, req.body, {
    userEmail: req.currentUser.email,
    ipAddress: req.ip,
  });

  res.render('modules/campanaEditar', {
    campaigns: campaignService.listCampaigns(),
    pageMessage: {
      type: result.success ? 'success' : 'danger',
      text: result.message,
    },
  });
};

exports.cancelacionCampana = (req, res) => {
  res.render('modules/campanaCancelacion', {
    campaigns: campaignService.listCampaigns(),
  });
};

exports.cancelacionCampanaPost = (req, res) => {
  const result = campaignService.updateCancellationWindow(
    req.body.campaignId,
    req.body.cancellationWindowHours,
    {
      userEmail: req.currentUser.email,
      ipAddress: req.ip,
    }
  );

  res.render('modules/campanaCancelacion', {
    campaigns: campaignService.listCampaigns(),
    pageMessage: {
      type: result.success ? 'success' : 'danger',
      text: result.message,
    },
  });
};

exports.estadoCampana = (req, res) => {
  res.render('modules/campanaEstado', {
    campaigns: campaignService.listCampaigns(),
  });
};

exports.activarCampana = (req, res) => {
  const result = campaignService.activateCampaign(req.params.id, {
    userEmail: req.currentUser.email,
    ipAddress: req.ip,
  });

  res.render('modules/campanaEstado', {
    campaigns: campaignService.listCampaigns(),
    pageMessage: {
      type: result.success ? 'success' : 'danger',
      text: result.message,
    },
  });
};

exports.desactivarCampana = (req, res) => {
  const result = campaignService.deactivateCampaign(req.params.id, {
    userEmail: req.currentUser.email,
    ipAddress: req.ip,
  });

  res.render('modules/campanaEstado', {
    campaigns: campaignService.listCampaigns(),
    pageMessage: {
      type: result.success ? 'success' : 'danger',
      text: result.message,
    },
  });
};
