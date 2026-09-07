/**
 * licenseClientController — local (on-device) license endpoints used by the
 * desktop renderer. NOT the admin/issuer API (that is the offline CLI).
 *
 *   GET  /api/license/status    current enforcement snapshot (+ trusted time)
 *   POST /api/license/activate  { licenseKey }  -> bind this device
 *   POST /api/license/refresh   force a re-evaluation now
 */

'use strict';

const licenseState = require('../licensing/licenseState');
const { getTrustedTime } = require('../licensing/trustedTime');
const { audit } = require('../licensing/auditClient');
const { ENFORCED } = require('../licensing/enforcement');

function publicState(st) {
  return {
    ok: !!st.ok,
    status: st.status,
    code: st.code || null,
    message: st.reason || null,
    online: !!st.online,
    enforced: ENFORCED,
    expiresAt: st.expiresAt ? new Date(st.expiresAt).toISOString() : null,
    warning: st.warning || null,
    limit: st.limit != null ? st.limit : null,
    current: st.current != null ? st.current : null,
    customerName: st.customerName || null,
    features: st.features || [],
    evaluatedAt: st.evaluatedAt || null
  };
}

module.exports = {
  getStatus: async (req, res) => {
    // refresh in the background so repeated polls converge, but answer from cache
    licenseState.evaluate().catch(() => {});
    let serverTime = null;
    try { serverTime = (await getTrustedTime()).time.toISOString(); } catch (e) {}
    return res.json({ success: true, serverTime, license: publicState(licenseState.getState()) });
  },

  activate: async (req, res) => {
    const licenseKey = (req.body && (req.body.licenseKey || req.body.license || req.body.key)) || '';
    if (!licenseKey || typeof licenseKey !== 'string') {
      return res.status(400).json({ success: false, code: 'INVALID_LICENSE', message: 'Provide a license key.' });
    }
    try {
      const st = await licenseState.activate({ licString: licenseKey.trim() });
      return res.json({ success: true, license: publicState(st) });
    } catch (e) {
      await audit('LICENSE_VALIDATION_FAILED', { detail: { where: 'activate', code: e.code || 'ERROR' } });
      return res.status(400).json({
        success: false,
        code: e.code || 'ACTIVATION_FAILED',
        message: e.message || 'Activation failed.'
      });
    }
  },

  refresh: async (req, res) => {
    try {
      const st = await licenseState.evaluate({ force: true });
      return res.json({ success: true, license: publicState(st) });
    } catch (e) {
      return res.status(500).json({ success: false, code: 'REFRESH_FAILED', message: e.message });
    }
  }
};
