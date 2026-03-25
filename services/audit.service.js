const db = require('../data/mock-db');
const auditRepository = require('../repositories/audit.repository');
const { formatDateTime } = require('../utils/date.util');

function record({
  user = 'sistema@local',
  module = 'General',
  action,
  result = 'OK',
  details = '',
  ipAddress = '127.0.0.1',
}) {
  const entry = {
    id: `audit-${String(db.counters.audit).padStart(3, '0')}`,
    timestamp: new Date().toISOString(),
    user,
    module,
    action,
    result,
    details,
    ipAddress,
  };

  db.counters.audit += 1;
  return auditRepository.create(entry);
}

function listEntries() {
  return auditRepository.getAll().map((entry) => ({
    ...entry,
    formattedTimestamp: formatDateTime(entry.timestamp),
  }));
}

module.exports = {
  listEntries,
  record,
};
