const authService = require('../services/auth.service');
const campaignService = require('../services/campaign.service');
const { parseCookies } = require('../utils/cookie.util');

function attachRequestContext(req, res, next) {
  const cookies = parseCookies(req.headers.cookie || '');
  const session = authService.getSessionByToken(cookies.admin_session);

  req.currentUser = session ? session.user : null;
  req.sessionToken = session ? session.token : null;

  const activeCampaign = campaignService.getActiveCampaign();
  res.locals.currentUser = req.currentUser;
  res.locals.currentPath = req.originalUrl;
  res.locals.activeCampaign = activeCampaign;
  res.locals.campaignTimerLabel = activeCampaign
    ? activeCampaign.countdown.label
    : 'Sin campana activa';
  res.locals.pageMessage = null;

  next();
}

function requireAdminSession(req, res, next) {
  if (req.currentUser) {
    return next();
  }

  authService.logExpiredSession(req.ip);
  return res.redirect('/?reason=session-expired');
}

module.exports = {
  attachRequestContext,
  requireAdminSession,
};
