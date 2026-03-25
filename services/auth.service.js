const crypto = require('crypto');
const sessionRepository = require('../repositories/session.repository');
const auditService = require('./audit.service');

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

function buildDisplayName(email) {
  const localPart = String(email).split('@')[0] || 'admin';
  return localPart
    .split(/[._-]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function createSession(email, ipAddress) {
  const session = {
    token: crypto.randomUUID(),
    user: {
      email,
      name: buildDisplayName(email),
      role: 'Administrador',
    },
    expiresAt: Date.now() + SESSION_DURATION_MS,
  };

  sessionRepository.create(session);
  auditService.record({
    user: email,
    module: 'Acceso',
    action: 'Inicio de sesion',
    result: 'OK',
    details: 'Sesion administrativa iniciada en entorno mock.',
    ipAddress,
  });
  return session;
}

function login({ email, password, ipAddress }) {
  if (!email || !password) {
    auditService.record({
      user: email || 'anonimo',
      module: 'Acceso',
      action: 'Inicio de sesion',
      result: 'ERROR',
      details: 'Intento de inicio de sesion con campos vacios.',
      ipAddress,
    });
    return {
      success: false,
      message: 'Debes capturar correo y contrasena para iniciar sesion.',
    };
  }

  return {
    success: true,
    session: createSession(email, ipAddress),
  };
}

function getSessionByToken(token) {
  if (!token) {
    return null;
  }

  const session = sessionRepository.getByToken(token);
  if (!session) {
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    sessionRepository.deleteByToken(token);
    return null;
  }

  return session;
}

function logout(token, ipAddress = '127.0.0.1') {
  const session = getSessionByToken(token);
  if (session) {
    auditService.record({
      user: session.user.email,
      module: 'Acceso',
      action: 'Cierre de sesion',
      result: 'OK',
      details: 'Sesion administrativa cerrada por el usuario.',
      ipAddress,
    });
  }

  sessionRepository.deleteByToken(token);
}

function logExpiredSession(ipAddress = '127.0.0.1') {
  auditService.record({
    user: 'anonimo',
    module: 'Acceso',
    action: 'Sesion no vigente',
    result: 'ERROR',
    details: 'Acceso administrativo redirigido a login por sesion invalida.',
    ipAddress,
  });
}

module.exports = {
  getSessionByToken,
  logExpiredSession,
  login,
  logout,
};
