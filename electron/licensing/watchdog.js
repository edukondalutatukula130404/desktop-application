/**
 * watchdog.js (Electron main) — periodic + event-driven license re-evaluation
 * using a MONOTONIC clock so moving the wall clock cannot pause enforcement.
 *
 * Fires `onChange(state)` whenever the enforcement status transitions, so the
 * main process can push `license:state` to the renderer and lock the app.
 */

'use strict';

const licenseState = require('../../backend/src/licensing/licenseState');

let timer = null;
let onChange = () => {};
let lastStatus = null;

let baseHr = process.hrtime.bigint();
let baseWall = Date.now();

function monotonicElapsedMs() {
  return Number((process.hrtime.bigint() - baseHr) / 1000000n);
}

/** wall-clock vs monotonic divergence since watchdog start (ms). Positive = clock jumped forward. */
function clockDivergenceMs() {
  return (Date.now() - baseWall) - monotonicElapsedMs();
}

async function tick() {
  let st;
  try {
    st = await licenseState.evaluate({ divergenceMs: clockDivergenceMs() });
  } catch (e) {
    st = licenseState.getState();
  }
  if (st && st.status !== lastStatus) {
    lastStatus = st.status;
    try { onChange(st); } catch (e) {}
  }
  return st;
}

function start(opts = {}) {
  onChange = typeof opts.onChange === 'function' ? opts.onChange : onChange;
  // 20s → a revoke / suspend / expiry / extension reaches the client in well
  // under 2 minutes. The Atlas write per tick is throttled in licenseState.
  const intervalMs = opts.intervalMs || 20000;
  stop();
  baseHr = process.hrtime.bigint();
  baseWall = Date.now();
  tick();
  timer = setInterval(tick, intervalMs);
  if (timer.unref) timer.unref();
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

async function forceCheck() {
  return tick();
}

module.exports = { start, stop, forceCheck, monotonicElapsedMs, clockDivergenceMs };
