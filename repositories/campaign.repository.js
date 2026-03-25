const db = require('../data/mock-db');

function getAll() {
  return [...db.campaigns].sort((a, b) => a.name.localeCompare(b.name));
}

function getById(campaignId) {
  return db.campaigns.find((campaign) => campaign.id === campaignId) || null;
}

function getActive() {
  return db.campaigns.find((campaign) => campaign.status === 'active') || null;
}

function create(campaign) {
  db.campaigns.push(campaign);
  return campaign;
}

function update(campaignId, updates) {
  const campaign = getById(campaignId);
  if (!campaign) {
    return null;
  }

  Object.assign(campaign, updates);
  return campaign;
}

module.exports = {
  create,
  getActive,
  getAll,
  getById,
  update,
};
