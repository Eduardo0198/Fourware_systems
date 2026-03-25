const db = require('../data/mock-db');
const campaignRepository = require('../repositories/campaign.repository');
const productRepository = require('../repositories/product.repository');
const auditService = require('./audit.service');
const campaignService = require('./campaign.service');

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeNumber(value) {
  const parsedValue = Number.parseFloat(value);
  return Number.isFinite(parsedValue) ? parsedValue : NaN;
}

function validateProductPayload(input) {
  const payload = {
    sku: normalizeText(input.sku),
    commercialName: normalizeText(input.commercialName),
    description: normalizeText(input.description),
    saleUnit: normalizeText(input.saleUnit),
    primaryUnitMeasure: normalizeText(input.primaryUnitMeasure),
    unitPrice: normalizeNumber(input.unitPrice),
    unitWeight: normalizeNumber(input.unitWeight),
    unitVolume: normalizeNumber(input.unitVolume),
    imagePath: normalizeText(input.imagePath),
    campaignId: normalizeText(input.campaignId),
  };

  const requiredFields = [
    payload.sku,
    payload.commercialName,
    payload.description,
    payload.saleUnit,
    payload.primaryUnitMeasure,
    payload.imagePath,
    payload.campaignId,
  ];

  if (requiredFields.some((value) => !value)) {
    return {
      valid: false,
      success: false,
      message: 'Los datos ingresados no son validos. Completa todos los campos requeridos.',
      payload,
    };
  }

  if (
    [payload.unitPrice, payload.unitWeight, payload.unitVolume].some(
      (value) => !Number.isFinite(value) || value <= 0
    )
  ) {
    return {
      valid: false,
      success: false,
      message: 'Precio, peso y volumen deben ser mayores a cero.',
      payload,
    };
  }

  return {
    valid: true,
    payload,
  };
}

function registerProduct(input, { userEmail, ipAddress }) {
  const validation = validateProductPayload(input);
  if (!validation.valid) {
    return validation;
  }

  const payload = validation.payload;
  const existingProduct = productRepository.findBySku(payload.sku);
  if (existingProduct) {
    return {
      success: false,
      message: 'El SKU ingresado ya se encuentra registrado.',
      payload,
    };
  }

  const campaign = campaignRepository.getById(payload.campaignId);
  if (!campaign || campaign.status !== 'active' || !campaignService.isCampaignValid(campaign)) {
    return {
      success: false,
      message: 'La campana seleccionada no es valida.',
      payload,
    };
  }

  const product = {
    id: `prod-${String(db.counters.product).padStart(3, '0')}`,
    ...payload,
    status: 'inactive',
    createdAt: new Date().toISOString(),
  };

  db.counters.product += 1;
  productRepository.create(product);
  auditService.record({
    user: userEmail,
    module: 'Catalogo',
    action: 'Registro de producto',
    result: 'OK',
    details: `${product.sku} asociado a ${campaign.name} con estado inicial inactivo.`,
    ipAddress,
  });

  return {
    success: true,
    message: 'Producto registrado correctamente en el catalogo.',
    product,
  };
}

function getRegistrationContext(referenceDate = new Date()) {
  return {
    campaignOptions: campaignService.getValidCampaignOptions(referenceDate),
    products: productRepository.getAll().map((product) => {
      const campaign = campaignRepository.getById(product.campaignId);
      return {
        ...product,
        campaignName: campaign ? campaign.name : 'Sin campana',
      };
    }),
  };
}

module.exports = {
  getRegistrationContext,
  registerProduct,
};
