const db = require('../data/mock-db');
const campaignRepository = require('../repositories/campaign.repository');
const productRepository = require('../repositories/product.repository');
const auditService = require('./audit.service');
const {
  addDays,
  differenceInDays,
  formatDate,
  formatIsoDate,
  getCountdown,
  isDateWithinRange,
  toDate,
} = require('../utils/date.util');

function translateStatus(status) {
  switch (status) {
    case 'active':
      return 'Activa';
    case 'inactive':
      return 'Inactiva';
    case 'cancelled':
      return 'Cancelada';
    default:
      return 'Desconocido';
  }
}

function isCampaignValid(campaign, referenceDate = new Date()) {
  if (!campaign) {
    return false;
  }

  return (
    campaign.status !== 'cancelled' &&
    isDateWithinRange(referenceDate, campaign.startDate, campaign.endDate)
  );
}

function buildCampaignViewModel(campaign, referenceDate = new Date()) {
  const countdown = campaign.status === 'active'
    ? getCountdown(campaign.endDate, referenceDate)
    : null;
  const isCurrentlyValid = isCampaignValid(campaign, referenceDate);

  return {
    ...campaign,
    formattedStartDate: formatDate(campaign.startDate),
    formattedEndDate: formatDate(campaign.endDate),
    isCurrentlyValid,
    countdown,
    productCount: productRepository.getByCampaignId(campaign.id).length,
    statusLabel: translateStatus(campaign.status),
    canActivate: campaign.status !== 'active' && isCurrentlyValid,
  };
}

function listCampaigns(referenceDate = new Date()) {
  return campaignRepository
    .getAll()
    .map((campaign) => buildCampaignViewModel(campaign, referenceDate));
}

function getActiveCampaign(referenceDate = new Date()) {
  const campaign = campaignRepository.getActive();
  return campaign ? buildCampaignViewModel(campaign, referenceDate) : null;
}

function getValidCampaignOptions(referenceDate = new Date()) {
  return listCampaigns(referenceDate).map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    formattedRange: `${campaign.formattedStartDate} - ${campaign.formattedEndDate}`,
    disabled: !campaign.isCurrentlyValid || campaign.status !== 'active',
    statusLabel: campaign.statusLabel,
  }));
}

function validateCampaignPayload(input) {
  const name = String(input.name || '').trim();
  const description = String(input.description || '').trim();
  const startDate = String(input.startDate || '').trim();
  const durationDays = Number.parseInt(input.durationDays, 10);
  const cancellationWindowHours = Number.parseInt(input.cancellationWindowHours, 10);
  const parsedStartDate = toDate(startDate);

  if (!name || !description || !startDate) {
    return {
      valid: false,
      message: 'Debes completar nombre, descripcion y fecha de inicio.',
    };
  }

  if (!parsedStartDate) {
    return {
      valid: false,
      message: 'La fecha de inicio no es valida.',
    };
  }

  if (!Number.isInteger(durationDays) || durationDays <= 0) {
    return {
      valid: false,
      message: 'La duracion de la campana debe ser un numero entero mayor a cero.',
    };
  }

  if (!Number.isInteger(cancellationWindowHours) || cancellationWindowHours <= 0) {
    return {
      valid: false,
      message: 'La ventana de cancelacion debe ser un numero entero mayor a cero.',
    };
  }

  const endDate = addDays(parsedStartDate, durationDays - 1);

  return {
    valid: true,
    value: {
      name,
      description,
      startDate: formatIsoDate(parsedStartDate),
      endDate: formatIsoDate(endDate),
      durationDays,
      cancellationWindowHours,
    },
  };
}

function createCampaign(input, { userEmail, ipAddress }) {
  const validation = validateCampaignPayload(input);
  if (!validation.valid) {
    return validation;
  }

  const campaign = {
    id: `camp-${String(db.counters.campaign).padStart(3, '0')}`,
    ...validation.value,
    status: 'inactive',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.counters.campaign += 1;
  campaignRepository.create(campaign);
  auditService.record({
    user: userEmail,
    module: 'Campanas',
    action: 'Registro de campana',
    result: 'OK',
    details: `${campaign.name} creada con vigencia de ${campaign.durationDays} dias.`,
    ipAddress,
  });

  return {
    success: true,
    message: 'Campana registrada correctamente.',
    campaign,
  };
}

function activateCampaign(campaignId, { userEmail, ipAddress }) {
  const campaign = campaignRepository.getById(campaignId);
  if (!campaign) {
    return {
      success: false,
      message: 'La campana seleccionada no existe.',
    };
  }

  if (!isCampaignValid(campaign)) {
    return {
      success: false,
      message: 'La campana seleccionada no es valida para la fecha actual.',
    };
  }

  const currentActive = campaignRepository.getActive();
  if (currentActive && currentActive.id !== campaign.id) {
    campaignRepository.update(currentActive.id, {
      status: 'inactive',
      updatedAt: new Date().toISOString(),
    });
  }

  campaignRepository.update(campaign.id, {
    status: 'active',
    updatedAt: new Date().toISOString(),
  });

  auditService.record({
    user: userEmail,
    module: 'Campanas',
    action: 'Configuracion de campana activa',
    result: 'OK',
    details: `${campaign.name} configurada como unica campana activa.`,
    ipAddress,
  });

  return {
    success: true,
    message: 'Campana activa configurada correctamente.',
  };
}

function deactivateCampaign(campaignId, { userEmail, ipAddress }) {
  const campaign = campaignRepository.getById(campaignId);
  if (!campaign) {
    return {
      success: false,
      message: 'La campana seleccionada no existe.',
    };
  }

  campaignRepository.update(campaign.id, {
    status: 'inactive',
    updatedAt: new Date().toISOString(),
  });

  auditService.record({
    user: userEmail,
    module: 'Campanas',
    action: 'Desactivacion de campana',
    result: 'OK',
    details: `${campaign.name} paso a estado inactivo.`,
    ipAddress,
  });

  return {
    success: true,
    message: 'Campana desactivada correctamente.',
  };
}

function updateCampaign(campaignId, input, { userEmail, ipAddress }) {
  const campaign = campaignRepository.getById(campaignId);
  if (!campaign) {
    return {
      success: false,
      message: 'La campana seleccionada no existe.',
    };
  }

  const validation = validateCampaignPayload(input);
  if (!validation.valid) {
    return validation;
  }

  campaignRepository.update(campaignId, {
    ...validation.value,
    updatedAt: new Date().toISOString(),
  });

  auditService.record({
    user: userEmail,
    module: 'Campanas',
    action: 'Edicion de campana',
    result: 'OK',
    details: `${campaign.name} actualizada por administrador.`,
    ipAddress,
  });

  return {
    success: true,
    message: 'Campana actualizada correctamente.',
  };
}

function updateCancellationWindow(campaignId, hours, { userEmail, ipAddress }) {
  const campaign = campaignRepository.getById(campaignId);
  const parsedHours = Number.parseInt(hours, 10);

  if (!campaign) {
    return {
      success: false,
      message: 'La campana seleccionada no existe.',
    };
  }

  if (!Number.isInteger(parsedHours) || parsedHours <= 0) {
    return {
      success: false,
      message: 'Debes capturar una ventana de cancelacion valida.',
    };
  }

  campaignRepository.update(campaignId, {
    cancellationWindowHours: parsedHours,
    updatedAt: new Date().toISOString(),
  });

  auditService.record({
    user: userEmail,
    module: 'Campanas',
    action: 'Configuracion de ventana de cancelacion',
    result: 'OK',
    details: `${campaign.name} actualizada a ${parsedHours} horas de cancelacion.`,
    ipAddress,
  });

  return {
    success: true,
    message: 'Ventana de cancelacion guardada correctamente.',
  };
}

function getDashboardData(referenceDate = new Date()) {
  const campaigns = listCampaigns(referenceDate);
  const activeCampaign = getActiveCampaign(referenceDate);
  const products = productRepository.getAll();
  const validCampaigns = campaigns.filter((campaign) => campaign.isCurrentlyValid);

  return {
    activeCampaign,
    campaigns,
    metrics: {
      totalCampaigns: campaigns.length,
      validCampaigns: validCampaigns.length,
      totalProducts: products.length,
      inactiveProducts: products.filter((product) => product.status === 'inactive').length,
    },
    recentProducts: products.slice(0, 4).map((product) => {
      const campaign = campaignRepository.getById(product.campaignId);
      return {
        ...product,
        campaignName: campaign ? campaign.name : 'Sin campana',
      };
    }),
  };
}

function getCampaignSummaryCards(referenceDate = new Date()) {
  const campaigns = listCampaigns(referenceDate);
  return {
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter((campaign) => campaign.status === 'active').length,
    validCampaigns: campaigns.filter((campaign) => campaign.isCurrentlyValid).length,
    averageDuration: campaigns.length
      ? Math.round(
          campaigns.reduce(
            (sum, campaign) =>
              sum + differenceInDays(campaign.startDate, campaign.endDate),
            0
          ) / campaigns.length
        )
      : 0,
  };
}

module.exports = {
  activateCampaign,
  createCampaign,
  deactivateCampaign,
  getActiveCampaign,
  getCampaignSummaryCards,
  getDashboardData,
  getValidCampaignOptions,
  isCampaignValid,
  listCampaigns,
  updateCampaign,
  updateCancellationWindow,
};
