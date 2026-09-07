/**
 * enforcement.js — the single switch that decides whether license failures
 * actually block the app.
 *
 *   - packaged / production build  -> ALWAYS enforced
 *   - development                  -> enforced only when LICENSE_ENFORCE=1
 *
 * Read by licenseMiddleware (server) and surfaced to the renderer via
 * /api/license/status + the license IPC, so the on-device gate matches the API.
 */

'use strict';

const IS_PROD = process.env.NODE_ENV === 'production';
const DEV_ENFORCE = process.env.LICENSE_ENFORCE === '1';

const ENFORCED = IS_PROD || DEV_ENFORCE;

module.exports = { ENFORCED, IS_PROD };
