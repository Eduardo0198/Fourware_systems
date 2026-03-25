const db = require('../data/mock-db');

function getAll() {
  return [...db.products].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function getByCampaignId(campaignId) {
  return db.products.filter((product) => product.campaignId === campaignId);
}

function findBySku(sku) {
  return (
    db.products.find(
      (product) => product.sku.toLowerCase() === String(sku).trim().toLowerCase()
    ) || null
  );
}

function create(product) {
  db.products.push(product);
  return product;
}

module.exports = {
  create,
  findBySku,
  getAll,
  getByCampaignId,
};
