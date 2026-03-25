const db = require('../data/mock-db');

function create(session) {
  db.sessions.set(session.token, session);
  return session;
}

function getByToken(token) {
  return db.sessions.get(token) || null;
}

function deleteByToken(token) {
  db.sessions.delete(token);
}

module.exports = {
  create,
  deleteByToken,
  getByToken,
};
