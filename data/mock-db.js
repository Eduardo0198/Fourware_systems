const now = new Date();

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function shiftDate(baseDate, days) {
  const result = new Date(baseDate);
  result.setDate(result.getDate() + days);
  return result;
}

const activeStart = shiftDate(now, -5);
const activeEnd = shiftDate(activeStart, 29);
const upcomingStart = shiftDate(now, 25);
const upcomingEnd = shiftDate(upcomingStart, 29);

module.exports = {
  campaigns: [
    {
      id: 'camp-001',
      name: 'Campana Primavera',
      description: 'Preventa nacional para linea arquitectonica.',
      startDate: isoDate(activeStart),
      endDate: isoDate(activeEnd),
      durationDays: 30,
      cancellationWindowHours: 48,
      status: 'active',
      createdAt: shiftDate(now, -8).toISOString(),
      updatedAt: shiftDate(now, -1).toISOString(),
    },
    {
      id: 'camp-002',
      name: 'Campana Industrial Norte',
      description: 'Campana programada para distribuidores industriales.',
      startDate: isoDate(upcomingStart),
      endDate: isoDate(upcomingEnd),
      durationDays: 30,
      cancellationWindowHours: 24,
      status: 'inactive',
      createdAt: shiftDate(now, -3).toISOString(),
      updatedAt: shiftDate(now, -3).toISOString(),
    },
  ],
  products: [
    {
      id: 'prod-001',
      sku: 'SKU-PPG-1001',
      commercialName: 'Sellador Acrilico Premium',
      description: 'Sellador base agua para superficies interiores.',
      saleUnit: 'Caja',
      primaryUnitMeasure: 'Litro',
      unitPrice: 1299,
      unitWeight: 12.5,
      unitVolume: 0.032,
      imagePath: '/img/productos/sellador-acrilico.png',
      campaignId: 'camp-001',
      status: 'inactive',
      createdAt: shiftDate(now, -2).toISOString(),
    },
  ],
  auditLogs: [
    {
      id: 'audit-001',
      timestamp: shiftDate(now, -2).toISOString(),
      user: 'admin@ppg.com',
      module: 'Catalogo',
      action: 'Registro de producto',
      result: 'OK',
      details: 'SKU SKU-PPG-1001 asociado a camp-001.',
      ipAddress: '127.0.0.1',
    },
    {
      id: 'audit-002',
      timestamp: shiftDate(now, -1).toISOString(),
      user: 'admin@ppg.com',
      module: 'Campanas',
      action: 'Activacion de campana',
      result: 'OK',
      details: 'camp-001 establecida como campana activa.',
      ipAddress: '127.0.0.1',
    },
  ],
  sessions: new Map(),
  counters: {
    campaign: 3,
    product: 2,
    audit: 3,
    session: 1,
  },
};
