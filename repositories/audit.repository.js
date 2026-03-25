const db = require('../data/mock-db');

function getAll() {
  return [...db.auditLogs].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function create(logEntry) {
  db.auditLogs.push(logEntry);
  return logEntry;
}

module.exports = {
  create,
  getAll,
};
