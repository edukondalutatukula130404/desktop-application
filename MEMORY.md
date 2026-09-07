# Project Memory

## 1. Project Snapshot
- **App**: NexusSuite (aka InvoicePro) — Electron desktop billing/invoicing app for a single clothing shop.
- **Stack**: Electron 30 + Express backend (in-process, port 5050) + Vite/vanilla-JS frontend (`frontend/src/js/app.js`, ~7k lines, no framework).
- **DB**: MongoDB Atlas (shared cloud) via Mongoose. Local cache = JSON file store at `%APPDATA%/InvoiceProDesktop/local-data/store.json` (module misnamed `sqliteStore`, it is NOT sqlite). Optional `mongodb-memory-server` fallback.
- **Auth**: JWT. Secret + Mongo URI come from env; packaged build ships `electron/app.env` → `resources/app.env` (electron-builder `extraResources`), loaded in `electron/main.cjs` before backend require.
- **Build**: `npm run dist:installer` → `dist-installer/NexusSuite-Windows-Installer.exe` (NSIS).
- **Run (dev)**: must `unset ELECTRON_RUN_AS_NODE` first (IDE sets it, breaks Electron). `npm run dev` OR run vite + `node_modules/electron/dist/electron.exe .` with `ELECTRON_START_URL`.

## 2. Data Flow
- Frontend → `/api/business/*` → `businessController` → `dataStore` (merges Atlas `Model.find({})` + local JSON store).
- `dataStore` reads are UNSCOPED (single shared shop, `companyId: 'shop_default'`). Do not re-add `userId` filters — that hides cloud data on other devices.
- Background `syncEngine` (5s pulse) pushes local queue → Atlas and pulls Atlas → local.

## 3. Backup / Restore (cross-device workflow the client uses daily)
- Device A **Backup Now** → `createBackup`: pure snapshot upload to `Backup` collection. MUST NOT mutate/delete live collections. Fails loudly if offline/unverified. Keeps 30 most recent per account.
- Device B **Restore** → `restoreBackup`: loads ONE snapshot verbatim into local store (non-destructive upserts, `skipSyncQueue`). No merge with live `find({})`, no cloud deletes.
- `dataStore.backupAllData` is DESTRUCTIVE (deletes Atlas rows not in the passed array) — only safe for its original narrow use; never call it from backup/restore.

## 4. Invoice IDs
- Frontend mints `INV-<yyyymmdd><NNN>` from a per-device `localStorage` counter (`inv_seq_<date>`) — collides across devices/reinstalls.
- `dataStore.createInvoice` resolves a collision-safe id BEFORE writing: if requested id exists in Atlas, assigns next free `INV-<date><NNN>` (cluster-wide scan), never overwrites. Frontend adopts `res.invoice.id` for PDF/list and bumps its local counter.
- `getInvoices` dedups by EXACT id for display only — the old destructive `Invoice.deleteMany` was removed (it wiped real sales).

## 5. Form validation
- Shared helper in `app.js`: `validateForm([{id|el, label, required, type:'email'|'number', min,max,gt,gte,lte,pattern,patternMsg,custom}])` → inline `.field-invalid` + `.field-error-msg` (styles injected by `injectValidationStyles`) + summary toast; returns `{ok, errors}`.
- Wired into: login, register, product save (page+modal), category save, bill create, settings save, invoice create (page preview/print + modal) with per-row qty/price/name checks.
- `printInvoiceDirect` / `shareInvoiceWhatsApp` guarded by `invoiceFormHasPrintableItems()` — no OS print dialog for empty invoices.
- No Supplier/Brand/standalone-Customer forms exist in the UI (backend routes exist, unused). Customers auto-created from invoices via `getOrCreateCustomer`.

## 6. Known constraints / gotchas
- Atlas credentials are embedded in the installer (`app.env` + hardcoded fallback in `backend/src/db/connect.js`). Acceptable for one trusted client only.
- Menu bar removed (`Menu.setApplicationMenu(null)` + `autoHideMenuBar` in `main.cjs`).
- Frontend API port probe: 5050 first, 900ms timeout (was 5000–5005 first with 2.5s each → slow login).
- `mongoManager` must never overwrite a real cloud `MONGO_URI` with the embedded-local one (guarded in `main.cjs`).
- Git Bash here has **no `pkill`** — use PowerShell `Stop-Process -Name electron -Force` to kill Electron. A `pkill && node ... electron.exe` chain silently no-ops and the OLD instance keeps holding port 5050.

## 7. Auth
- `authController.login`: validates email format + password length (≥6); auto-registers a genuinely new email; an **existing** account with a wrong password now returns 401 (the old code silently re-hashed & saved whatever was typed — this had already corrupted `admin@gmail.com`'s password during testing).
- Frontend `handleUserLogin`: hard-requires typed email+password, no `admin@gmail.com`/`123456` fallback. Offline / server-unreachable sign-in is allowed **only** if `nexus_last_auth_email` (set on a prior successful server login on this device) matches the entered email; otherwise it refuses.

## 8. Perf
- `dataStore.getInvoices` no longer rewrites every fetched invoice back into the JSON store on each read (was N full-file writes per dashboard load). Cloud list reads are capped: invoices/bills `.limit(2000)`, products `.limit(5000)`.

## 9. /impeccable audit remediation (Operate mode; light theme only)
- **Phase 1 (a11y floor) — DONE**: visible thin scrollbars (replaced global `scrollbar-width:none`); global `:focus-visible` outline (`!important`, beats the 4 `outline:none` resets); `prefers-reduced-motion` block; `nxConfirm()` in-app confirm dialog replaced all 4 `confirm()`; `modalA11y()` MutationObserver adds `role=dialog`/focus-trap/ESC to every `.modal-overlay`.
- **Phase 2 (theming) — DONE**: deleted dead `[data-theme="dark"]` token block; `#7c3aed`/`rgba(124,58,237,*)` → `var(--primary-accent)`/`color-mix(...)` everywhere (PDF array → `[147,51,234]`); `.toast` side-tab bars → tinted bg + `color-mix` border; `.gradient-text` → flat `color`.
- **Phase 3 (responsive tables) — DONE**: `.table-responsive` shows a real 9px scrollbar; `.data-table` min-width 820→640; opt-in `.data-table.stackable` + `@media(max-width:720px)` card-stack driven by `td[data-label]`. `stackable` + `data-label` added to Dashboard recent-invoices, Dashboard low-stock, All-Invoices (`#view-invoices`), Category-detail invoices & products tables. Icon buttons bumped to ≥36px (`ss-sz`, `ss-sz-del`). No Bills page exists in `index.html` (only in stale `dist/`).
- **Phase 4 (perf) — DONE**: removed `backdrop-filter:blur` from `.panel-card` (opaque `#fff`, ubiquitous) and `.inv-hero-banner` (kept translucent glass on `.modal-overlay` + `.auth-*`, transient screens only). Google Fonts trimmed 4→2 families (dropped Inter + Poppins; families later replaced entirely in Phase 5). Added `debounce(fn,wait=150)` helper near top of `app.js`; wrapped the 4 search `input` handlers (global search, `prd-page-search`, `cg-page-search`, inventory via `_renderInventoryViewDebounced`). Row actions now use ONE delegated `click` listener bound once per persistent `tbody` (guard `tbody.dataset.delegated`), with delete bodies extracted to `handleProductDelete` / `handleCategoryDelete` / `handleInventoryRemove` — replaced the per-row `forEach(addEventListener)` in products / categories / inventory renders. `transition: width` left on `.sidebar` (rare user toggle, refactor risk outweighs gain).
- **Phase 5 (polish) — DONE**: stripped emoji from the invoice Payment Mode `<select>` (`&#128181;` etc.) and from every `showToast(...)` message (~31 sites, incl. the ternary at ~5711) — the toast component already renders its own SVG status icon. Typeface upgraded off the overused list: **Bricolage Grotesque** (`--font-heading`) + **Hanken Grotesk** (`--font-family` body); Google Fonts link + `.auth-left-heading` updated; `index.html` detector now 0 findings.
- **Still open (needs user)**: junk records `Test Widget ₹9` / `aaaa` are live in Atlas + local store (not in source) — delete via Products page (delete now syncs) or explicitly authorize a DB cleanup. `/impeccable document` (writes DESIGN.md) + `/impeccable polish` are larger separate passes, not yet run.
- Accepted, not fixed: 3 `layout-transition` findings in `main.css` (lines 759 `.strength-bar-fill`, 896 + 1255 `.sidebar` collapse) — rare/one-shot user interactions, `transform`/`grid` refactor risk outweighs the gain.
- Detector: `node ~/.claude/skills/impeccable/scripts/detect.mjs --target <file>` (runs DEGRADED — regex only, no HTML parser modules).

## 10. Licensing system (Option A-lite: offline-signed license + Atlas as online authority)
Adds a production license layer to the existing app. ONE generic `.exe` for all customers; per-customer signed `.lic` carries the expiry. Any duration (1h…1y) or fixed date, set at issue time, never in the client. Decisions: Ed25519 signatures; offline CLI signs (private key never shipped/committed); the app's **existing Atlas cluster** is the online authority for status/revocation (no new server); offline enforcement = signed `.lic` + Electron `safeStorage` (DPAPI) vault + monotonic-clock checks. Defaults: `maxActivations` 2, `offlineGraceHours` 72, online re-validate every 10 min, first-run grace 0.

**Full pre-build report**: see conversation of 2026-09-07 (17-section report) — covers architecture, online/offline strategy, clock-tamper, device binding, file-by-file changes, DB, APIs, risks, test matrix, migration risk. `docs/LICENSING.md` (operator guide) to be written in the final phase.

**Phase 1 — DONE (model & keys)**
- `backend/src/licensing/licenseFormat.js` — SINGLE SOURCE OF TRUTH for the wire format: `SIGNED_FIELDS` order, `canonicalPayload()` (deterministic bytes for sign/verify), `encodeLicenseFile()`/`decodeLicenseFile()` (envelope = `base64url(JSON{payload,signature})`, single-line `.lic`), `assertPayloadShape()`, enums (`LICENSE_STATUS`, `BINDING_MODE`, `LICENSE_TYPE`, `LICENSE_ERROR`). `PRODUCT_ID='nexussuite-desktop'`, `PAYLOAD_VERSION=1`. Any change here = breaking; bump version.
- `backend/src/licensing/publicKeys.js` — embedded Ed25519 **public** keys by `keyId` (safe to ship). Dev key `nxs-dev-2026` baked in; replace with a prod key before shipping. Rotation notes in-file.
- `backend/src/models/License.js` — authoritative per-license record (status ACTIVE|EXPIRED|REVOKED|SUSPENDED, expiresAt, maxActivations, bindingMode, offlineGraceHours, keyId, activationCount, revoked/suspended metadata). Lives in the same Atlas cluster.
- `backend/src/models/LicenseActivation.js` — one row per `{licenseId, deviceHash}` (unique compound index); `fingerprintSignals` (hashed) for soft re-bind; status ACTIVE|DEACTIVATED.
- `backend/src/models/LicenseAuditLog.js` — append-only events (`LICENSE_AUDIT_EVENTS`, 14 types); `source` cli|desktop|system; no secrets.
- `tools/license-cli/` (offline operator tool, NOT shipped/deployed): `keygen.js`, `lib/keys.js` (Ed25519 keygen/load), `lib/sign.js` (`signLicense()` uses `canonicalPayload` + `crypto.sign(null,…)`), `selftest.js`, `.env.license.example`, `README.md`.
- `.gitignore` — added `tools/license-cli/keys/`, `tools/license-cli/.env.license`, `*.private.pem`, `dist-licenses/`, `*.lic`. Verified: private PEM is git-ignored.
- `package.json` scripts: `license:keygen|issue|revoke|extend|list|selftest`.
- **Verified**: `npm run license:selftest` passes — sign→encode→decode→verify round-trip, tampered `expiresAt` rejected, flipped signature byte rejected. Models load without a DB connection.

**Phase 2 — DONE (generation CLI)**
- `tools/license-cli/issue.js` — `--customer --customer-id (--duration 1h|7d|30d|1y | --expires-at <ISO>) [--features --edition --max-activations --binding soft|strict|none --offline-grace-hours --key-id --not-before --out --no-db]`. Signs (self-verifies), writes `dist-licenses/<customerId>__<licenseId>.lic`, upserts `License` row + `LICENSE_CREATED` audit in Atlas. `--no-db` = offline dry sign (no Atlas, no revocation). `licenseId = lic_<16hex>`.
- `tools/license-cli/revoke.js` — `--license <id> [--suspend | --reactivate] [--reason]` → sets Atlas `licenses.status` REVOKED|SUSPENDED|ACTIVE + audit. Client applies on next online validate.
- `tools/license-cli/extend.js` — `--license <id> (--expires-at <ISO> | --by 30d) [--reissue]`. Updates Atlas `expiresAt` (online clients honor it via `max(signed, Atlas)` rule — Phase 3 verifier); `--reissue` also writes a fresh `.lic` with the SAME licenseId (activations unaffected) for offline delivery.
- `tools/license-cli/list.js` — `[--customer-id | --license | --status | --activations | --json]` — reads `License` + `LicenseActivation` from Atlas.
- `tools/license-cli/lib/`: `duration.js` (`1h/90m/7d/2w/6mo/1y`→ms; mo=30d, y=365d), `db.js` (Atlas connect via `LICENSE_ADMIN_MONGO_URI` + `audit()`), `args.js` (flag parser), `keys.js`, `sign.js`.
- **Verified**: dry-issue of duration + fixed license → both sign, self-verify, and re-verify against `publicKeys.js`. `dist-licenses/` git-ignored.
- Operator must create `tools/license-cli/.env.license` (from `.env.license.example`) with `LICENSE_KEY_ID` + `LICENSE_ADMIN_MONGO_URI` before non-`--no-db` use.
**Phase 3 — DONE (backend validation)**
- The embedded Express backend runs IN the Electron main process (`main.cjs` does `require('../backend/server')`), so `licenseState` is a shared singleton — middleware/controllers and (Phase 4) main talk to it directly, no IPC. Only the renderer needs IPC.
- `backend/src/licensing/verifyLicense.js` — pure Ed25519 signature + shape + notBefore/expiresAt check against a caller-supplied `now`.
- `backend/src/licensing/trustedTime.js` — `getTrustedTime()` → Atlas server clock via `admin().command({hello:1})` `localTime` (trusted); offline → last-trusted time projected forward by `process.hrtime` monotonic delta (untrusted); else system clock.
- `backend/src/licensing/machineId.js` — default fingerprint (hashed OS signals) + `fingerprintMatchRatio()` weighted compare for soft re-bind. Electron main overrides in Phase 4.
- `backend/src/licensing/licenseState.js` — THE BRAIN (singleton). `init(adapters)` (`readVault/writeVault/getMachineFingerprint`; in-memory defaults), `activate({licString})` (verify → fingerprint → if online register+enforce maxActivations+soft re-bind in Atlas → persist vault), `evaluate()` (online: Atlas `License` status + `max(signed, Atlas)` expiry + activation check + trusted time; offline: signed `.lic` + vault + `max(system, maxSeenAnyTime, projected)` time + offline-grace + last-known atlasStatus), `getState()` (sync snapshot), `clearLocal()`. States: NOT_ACTIVATED / ACTIVE / EXPIRING_SOON / EXPIRED / REVOKED / SUSPENDED / GRACE / CLOCK_TAMPER / DEVICE_BLOCKED / TAMPERED / INVALID. Clock rollback below `maxSeenAnyTime` cannot restore access.
- `backend/src/licensing/auditClient.js` — best-effort desktop-side `LicenseAuditLog` writes (skips when offline).
- `backend/src/middleware/licenseMiddleware.js` — gates protected routes; 402 `LICENSE_NOT_ACTIVATED` / 403 for EXPIRED|REVOKED|SUSPENDED|GRACE|…; body `{ licenseBlocked:true, code, licenseStatus, message }`. **Enforced only when `NODE_ENV==='production'` OR `LICENSE_ENFORCE==='1'`** — dev is NOT blocked while building. (`authMiddleware` fail-open was deliberately NOT changed — hardening it needs the offline-token rework and is decoupled from licensing.)
- `backend/src/controllers/licenseClientController.js` + `routes/licenseClientRoutes.js` — `GET /api/license/status` (snapshot + `serverTime`), `POST /api/license/activate {licenseKey}` (rate-limited), `POST /api/license/refresh`. NOT behind auth/license middleware (reachable pre-login / while locked).
- `backend/server.js` — mounts `/api/license`; adds `licenseMiddleware` to `/api/business`, `/api/sync`, and the two inline PDF routes; `startServer()` calls `licenseState.init()` + `evaluate()` + a 60s interim refresh timer (Phase 4 replaces with the main-process monotonic watchdog).
- **Verified**: `npm run license:statetest` → 11/11 offline checks (activate/restart/expiry/rollback/grace/tamper/last-known-revoke). Backend boots clean with Atlas connected; `/api/license/status` returns fail-closed `NOT_ACTIVATED`; `/api/business/*` still works in dev (bypass); middleware returns 402 when `LICENSE_ENFORCE=1` + unlicensed. `package.json`: `license:selftest`, `license:statetest`.

**Phase 4 — DONE (Electron integration)**
- `electron/licensing/vault.js` — DPAPI (`safeStorage`) encrypted anchor at `%APPDATA%/invoicepro-desktop/license.vault` (userData → survives app reinstall). Fallback AES-256-GCM keyed off the machine fingerprint when `safeStorage` unavailable. `readVault()`: absent→null, present-but-undecryptable→**throws** (→ `licenseState` treats as `LICENSE_TAMPERED`). Atomic write via `.tmp`+rename, mode 0600.
- `electron/licensing/machineFingerprint.js` — Windows fingerprint: `MachineGuid` + `InstallDate` (via `reg query`) + MAC + CPU + mem bucket + hostname + user, each SHA-256'd; hash only. Non-Windows → falls back to `backend/src/licensing/machineId.js`.
- `electron/licensing/watchdog.js` — 30s tick + `powerMonitor` resume/unlock-screen → `licenseState.evaluate({ divergenceMs })`. `divergenceMs = wallDelta − monotonicDelta` (hrtime) → offline forward-jump > 24h ⇒ `CLOCK_CHANGE_DETECTED`. Fires `onChange(state)` on status transitions.
- `backend/src/licensing/machineId.js` — `fingerprintMatchRatio()` reworked to score the UNION of signal keys with a weight map (`machineGuid:4, mac:3, cpu:2, …`) so it works for BOTH the portable and Electron signal shapes.
- `backend/src/licensing/trustedTime.js` — added `LICENSE_FORCE_OFFLINE=1` test hook (forces the offline path w/o pulling network; must never be set in a prod build — Phase 6 afterPack asserts).
- `electron/main.cjs` — after `startServer()`: `licenseState.init({ readVault, writeVault, getMachineFingerprint })` (overrides the backend's in-memory default with the real DPAPI vault) → `evaluate()` → `watchdog.start({ onChange: st => mainWindow.webContents.send('license:state', st) })` + `powerMonitor` hooks. Added IPC: `license:get-state`, `license:refresh`, `license:activate` (also pushes `license:state`), `license:get-machine-id`, `license:clear`.
- `electron/preload.cjs` — `window.electronAPI.license = { getState, refresh, activate, getMachineId, clear, onStateChange(cb)→unsub }`.
- **Verified E2E on the real DPAPI vault** (dev, `LICENSE_ENFORCE=1 LICENSE_FORCE_OFFLINE=1`, 1-minute `.lic`): pre-activation `/api/business/*`→**402** `licenseBlocked`; `POST /api/license/activate`→`ok:true` `EXPIRING_SOON`, vault written **encrypted** (`enc:"safeStorage"`, 0 plaintext leaks); `/api/business/*`→**200**; after expiry watchdog→`EXPIRED`, `/api/business/*`→**403** `LICENSE_EXPIRED`; **after app restart → still EXPIRED** (no reset); refresh → still EXPIRED. Normal dev mode (no env flags) unaffected — app works, licensing reports NOT_ACTIVATED but does not block.

**Phase 5 — DONE (renderer gate + auto-logout)**
- `backend/src/licensing/enforcement.js` — the single `ENFORCED` switch (`NODE_ENV==='production' || LICENSE_ENFORCE==='1'`). Used by `licenseMiddleware`; surfaced to the renderer as `enforced` on `/api/license/status` + all license IPC so the on-device gate matches the API (dev with enforcement off → renderer never gates/locks).
- `frontend/src/js/license.js` (NEW, self-contained, injects own styles + overlay): `initLicensing({ onContinue, onLock })` called at `app.js` boot BEFORE `initSession()`. Gate: `ok` → `onContinue()` (runs `initSession()`); `NOT_ACTIVATED` → Activation overlay (key textarea + device id + Activate); any other not-ok → `lock()` = clear token + `nexus_auth_user`/`nexus_active_view`/`nexus_last_auth_email` + `disconnectSocket()` + `onLock()` + full-screen "License Expired/Revoked/Suspended/…" overlay (per-`code` copy). Monitors via: `window.electronAPI.license.onStateChange` (watchdog push, 30s), 10-min poll, `window 'online'`, socket `license:revoked|suspended|expired|updated`, and a `license:blocked` CustomEvent from `api.js`. `EXPIRING_SOON` → bottom warning banner ("expires in N minutes"). Activation success → `location.reload()` for a clean start.
- `frontend/src/js/app.js` — bare `initSession();` replaced with `initLicensing({ onContinue:()=>initSession(), onLock:()=>{ appData.user=null; } })`. Import added.
- `frontend/src/js/api.js` — `request()` on `!ok`: if `data.licenseBlocked` or `code` starts `LICENSE_` → dispatch `window 'license:blocked'` + tag the thrown error (`err.licenseBlocked`, `err.code`). Added `api.licenseStatus/licenseActivate/licenseRefresh`.
- `frontend/src/js/socket.js` — `license:revoked|suspended|expired|updated` added to `syncEvents`.
- `backend/src/middleware/licenseMiddleware.js` + `controllers/licenseClientController.js` + `electron/main.cjs` IPC/watchdog — all now source `ENFORCED` from `enforcement.js` and include `enforced` in payloads.
- **Verified E2E** (`LICENSE_ENFORCE=1 LICENSE_FORCE_OFFLINE=1`): status `enforced:true`+`NOT_ACTIVATED` → activate via `/api/license/activate` (what the overlay form calls) → `ok:true EXPIRING_SOON`, business API 200 → after 2-min expiry watchdog → `EXPIRED`, business API **403** `licenseBlocked LICENSE_EXPIRED` "License expired. Please contact your administrator." Normal dev (`enforced:false`) unaffected — app fully works, no overlay. vite resolves `license.js`. **NOTE: the overlay's visual rendering was not screenshot-verified from the agent env — user should eyeball the enforced flow once.**

**Phase 6 — DONE (security hardening)**
- `scripts/afterPack.cjs` — electron-builder `afterPack` hook. HARD-FAILS the build on: private-key blocks, `LICENSE_ADMIN_MONGO_URI=`/`LICENSE_PRIVATE_KEY*=` in env, `LICENSE_ENFORCE=1`/`LICENSE_FORCE_OFFLINE=1` env lines (regexes anchored to env-file line syntax so source *references* don't trip). WARNS (no fail) on embedded `mongodb://user:pass@` — the accepted single-tenant trade-off. Skips `node_modules`. Verified: passes on `backend/`, blocks on a private-key dir.
- `electron/app.env` — reduced to `PORT` + `NODE_ENV=production` only (still committed/shipped).
- `electron/app.secret.env` (NEW, **gitignored**) — holds `JWT_SECRET` + `MONGO_URI`; `electron/app.secret.env.example` committed. Shipped as `resources/app.secret.env` via `extraResources`.
- `electron/main.cjs loadEnvConfig()` — reordered: `app.secret.env` (resources / exeDir / `__dirname`) loaded FIRST, then `app.env`, then dev `.env`/`backend/.env` (dotenv keeps first value per key). Added a packaged-build guard: `if (app.isPackaged) { delete LICENSE_ENFORCE; delete LICENSE_FORCE_OFFLINE; NODE_ENV='production'; }` — enforcement cannot be weakened by editing client env.
- `package.json build`: `afterPack` hook; `files` now excludes `**/.env`, `**/.env.*`, `electron/app.env`, `electron/app.secret.env*`, `tools/**`, `dist-licenses/**`, `**/*.private.pem`, `backend/src/scripts/**`; `extraResources` adds `app.secret.env`.
- `.gitignore` — `electron/app.secret.env`.
- **Verified**: dev still connects to Atlas ("Using external MONGO_URI from environment" — now sourced from `app.secret.env`), business API 200, `app.secret.env` git-ignored. **Safety net**: `backend/src/db/connect.js` `DEFAULT_ATLAS_URI` + JWT fallbacks remain, so a missing `app.secret.env` at build time degrades gracefully rather than breaking connectivity (documented; should be removed for a hardened multi-tenant deployment).
- `docs/LICENSING.md` (NEW) — full operator guide: setup, issue/revoke/extend, activation, build, key rotation, troubleshooting, known limitations, recovery. No secrets.

**Phase 7 — DONE (automated tests)** — `npm test` (`node --test "tests/**/*.test.js"`), **36 tests pass**:
- `tests/licensing/format.test.js` — canonical determinism / key-order / extra-field independence, base64url, envelope round-trip, corrupt/empty rejection, shape validation.
- `tests/licensing/duration.test.js` — `parseDuration` specs + rejections.
- `tests/licensing/sign-verify.test.js` — sign→verify round-trip, tampered `expiresAt` rejected, unknown/wrong key rejected, expired vs `skipTimeChecks`, not-yet-valid. (Installs a throwaway keypair into `publicKeys.PUBLIC_KEYS` at runtime.)
- `tests/licensing/state.test.js` — offline: NOT_ACTIVATED, activate→ACTIVE, restart→ACTIVE, expiry→EXPIRED, rollback can't restore, grace→GRACE, tamper→TAMPERED, last-known REVOKED. Online (mocked Atlas via `require.cache` fakes for `License`/`LicenseActivation`/`auditClient` + mocked `getTrustedTime`): activation registers + `maxActivations` enforced, Atlas REVOKED wins, `max(signed, Atlas)` extension keeps it active.
- `tests/licensing/middleware.test.js` — 402 when not activated, 403 when expired, pass-through when enforcement OFF.
- `tests/licensing/afterpack.test.js` — clean tree passes; private-key block / operator-env / `LICENSE_ENFORCE=1` line fail; source *reference* to the toggle does NOT fail; embedded mongo creds only WARN.
- `package.json`: `test`, `test:licensing`. Legacy `license:selftest` / `license:statetest` still green.

**Phase 8 — PARTIAL (build verified here; clean-VM checks are for the user)**
- `npm run dist:installer` succeeds → `dist-installer/NexusSuite-Windows-Installer.exe` (~91 MB). `afterPack` ran and **PASSED** ("no private keys / operator env / dev toggles"), WARN only on the deliberately-shipped `resources/app.secret.env`.
- Packaged-app inspection (asar extracted + grepped + raw `.exe` grep): Ed25519 **signing private key body absent** (0 matches in the `.exe`); only the **public** key ships (`publicKeys.js`). No `.env.license`, no `tools/`, no `keys/`, no `LICENSE_ENFORCE=1`/`FORCE_OFFLINE=1` env lines. `resources/app.env` reduced to `PORT`+`NODE_ENV`. All 8 `backend/src/licensing/*` + 3 `electron/licensing/*` modules present.
- **STILL NEEDS THE USER (no clean Windows VM available to the agent)**: install the `.exe` on a fresh machine → activation screen → paste a real `.lic` → login → keep open past `expiresAt` → confirm the "License Expired" screen + auto-logout visually → restart app (still expired) → move system clock forward/back (can't extend) → edit `resources/app.env` / `app.secret.env` (can't extend) → uninstall+reinstall (still expired, vault in `%APPDATA%/invoicepro-desktop/`) → `license:revoke` then reconnect (locks). Checklist in `docs/LICENSING.md` §6/§8 + conversation.
- Also pending for a hardened deployment (documented, not blockers for one trusted client): remove the hardcoded `DEFAULT_ATLAS_URI`/JWT fallbacks in `backend/src/db/connect.js` + `authMiddleware.js`; Authenticode-sign the installer; harden `authMiddleware` fail-open.

### 2026-09-07 — production key live + first client handover prep
- **Production signing key `nxs-2026-01` generated.** Public key added to `backend/src/licensing/publicKeys.js`; `DEFAULT_KEY_ID` = `nxs-2026-01`. Dev key `nxs-dev-2026` kept (test suite uses it). Private key at `tools/license-cli/keys/nxs-2026-01.private.pem` (gitignored — **back it up offline**).
- `tools/license-cli/.env.license` created (gitignored): `LICENSE_KEY_ID=nxs-2026-01` + `LICENSE_ADMIN_MONGO_URI` = same Atlas URI as `electron/app.secret.env`.
- **Bug fixed** — `tools/license-cli/lib/db.js`: repo root and `backend/` each have their own `node_modules/mongoose`; the CLI connected one instance while models were on the other → writes "buffering timed out". Fix: `const mongoose = require('.../models/License').base`. Also raised connect/buffer timeouts. `license:issue/revoke/extend/list` now hit Atlas correctly.
- **Installer rebuilt** with the production public key → `dist-installer/NexusSuite-Windows-Installer.exe` (~91 MB). afterPack passed; `nxs-2026-01` public key present, signing private key 0 matches in the `.exe`.
- Demo license for "Charan - Textile" (`cus_charan_textile`): `lic_bbc728e2aebd2e16`, 10 min, `maxActivations:1`, Atlas `[ACTIVE]`. Short-lived — real handover re-issues right before sending. 36 tests still pass.

### 2026-09-07 — IST display
- `tools/license-cli/lib/tz.js` — `fmtIST()` (UTC+05:30, `YYYY-MM-DD HH:mm:ss IST`) + `parseFlexibleToDate()` (offset-aware; a bare `--expires-at` / `--not-before` is read as IST wall-clock). Wired into `issue.js`, `list.js`, `extend.js` (all human output + fixed-date input). Stored instants stay UTC — display/input only.
- `frontend/src/js/license.js` — `fmtIST()` (no seconds); warning banner shows "(expires <IST>)", the EXPIRED lock screen shows "Expired: <IST>".
- `tests/licensing/tz.test.js` added. `npm test` = **40 pass**. Installer rebuilt with the IST frontend.

### 2026-09-07 — lifecycle CLI completed
- `tools/license-cli/update.js` (`npm run license:update`) — change a live license's `--max-activations` / `--features` / `--binding` / `--offline-grace-hours` in the Atlas `licenses` row. `maxActivations`/`offlineGraceHours` apply at the client's next online check with no reissue; `features`/`binding` also need `extend --reissue` for offline devices.
- `tools/license-cli/deactivate.js` (`npm run license:deactivate -- --license lic_x --device <hashPrefix> | --all`) — sets `LicenseActivation` rows to DEACTIVATED + decrements `activationCount`, freeing slots for a replacement device (old device locks DEVICE_NOT_AUTHORIZED next online).
- Verified against Kusha's license: bump 1→2→1, and freed the slot my own test machine had consumed (`0e500b2f345a…` → DEACTIVATED, back to 0/1). `npm test` = 40 pass.
- NOTE: `licenseState.clearLocal()` / deleting the local vault does NOT free the Atlas slot — always use `license:deactivate`.

### 2026-09-07 — faster propagation + deactivated-device reactivation
- `_registerWithAtlas`: a DEACTIVATED activation row can now RE-ACTIVATE itself if the license has a free slot (was: hard `DEVICE_NOT_AUTHORIZED`). Only blocks when deactivated AND at capacity.
- Re-validation cadence tightened so revoke/suspend/extend/deactivate reach an online client in **≤ ~20-40s** (was ≤10 min): `electron/licensing/watchdog.js` intervalMs 30s→**20s** (+ `main.cjs`), `frontend/src/js/license.js` POLL_MS 10min→**90s** (backup), `backend/server.js` fallback timer 60s→**20s**. Atlas load kept low: `licenseState` READS every tick but the `LicenseActivation.lastValidatedAt` WRITE is throttled to once / 5 min (`ACT_HEARTBEAT_MS`).
- Installer rebuilt (13:07). `npm test` = 40 pass.

### 2026-09-07 — build with embedded license (client types nothing)
- **This is a SINGLE-CLIENT project.** `scripts/client-build.cjs` normal use = `npm run client:build -- --customer "Srikanth" --duration 30d --max-activations 2` — NO `--mongo-uri`: it uses the MongoDB already in `electron/app.secret.env` and does NOT modify that file. `--customer-id` auto-derives from `--customer` if omitted.
- Multi-client mode still supported: pass `--mongo-uri "..."` → writes a per-client `app.secret.env` (fresh JWT) for that build, restores after.
- `client:build` now **supersedes** (REVOKEs) any prior ACTIVE/SUSPENDED licenses for the same `customerId` before issuing the new one → exactly ONE live license per client, so `license:list --customer-id X` shows the single one to manage. (Gotcha found 2026-09-07: issued 3 Charan licenses, suspended the wrong one → client kept working.)
- Flow: issue signed `.lic` + register `licenses` row in the DB → copy to `electron/embedded-license.lic` (ships in `electron/**` inside the asar) → `dist:installer` → rename to `dist-installer/NexusSuite-<customerId>.exe` → remove embedded `.lic`. `.gitignore`: `electron/embedded-license.lic`.
- `electron/main.cjs` license wiring: adopts `embedded-license.lic` (checks `__dirname`, `resourcesPath`, exe dir) whenever the DPAPI vault is empty OR holds a DIFFERENT `licenseId` than the build ships with (self-heals a stale vault left by an earlier build/test — the vault lives in `%APPDATA%/invoicepro-desktop/` shared by dev + packaged app). Pushes `license:state` to the renderer. Client never sees the paste screen.
- `frontend/src/js/license.js`: `doContinue()` (fires `onContinue` exactly once, whenever the license first becomes OK — handles the async auto-activate). **NO license-key entry** — the overlay has only a message + Retry + Close (client types nothing, ever). `msgFor(st)` gives per-case client-friendly copy: EXPIRED ("Your license expired on <IST>…"), REVOKED ("Access Revoked"), SUSPENDED ("Access Paused — contact admin to resume"), **DEVICE_LIMIT** ("Your plan allows N devices. This computer would be an extra one…" using `st.limit`), GRACE, CLOCK_TAMPER, DEVICE_BLOCKED, TAMPERED, NOT_ACTIVATED ("Couldn't Activate — check internet, press Retry").
- `licenseState`: `setEmbeddedLicense(licStr)` — `evaluate()`/watchdog (re)tries activating the embedded license every cycle when the vault is empty OR holds a DIFFERENT licenseId (stale). So a 3rd device shows "Device Limit Reached" and **auto-recovers within ~20s** once the admin bumps `maxActivations` or frees a slot — no restart, no re-install. The activation-limit error now carries `e.limit`/`e.current` → surfaced as `st.limit`/`st.current` (also in `publicState` + IPC).
- `main.cjs` embedded-license wiring simplified to `licenseState.setEmbeddedLicense(str)` + one `evaluate({force:true})` (the retry/mismatch/limit logic lives in `licenseState`).
- Manage each client from the cloud, pointing the CLI at that client's DB: `LICENSE_ADMIN_MONGO_URI="<client db>" npm run license:extend|update|revoke|deactivate -- --license lic_xxx ...`. No new `.exe`, no re-share — propagates in ~20-40s.
- Verified E2E: `client:build` produced `NexusSuite-cus_demo.exe` with the embedded `.lic` + auto-activate code in the asar; `app.secret.env` restored; test license revoked. 40 tests pass.

### 2026-09-07 — clean slate
Wiped ALL Atlas licensing data (`licenses`/`license_activations`/`license_audit_logs` deleteMany), all local `dist-licenses/`, `dist-installer/`, and the local test vault. Fresh build: **Naveen** — `dist-installer/NexusSuite-cus_naveen.exe`, `lic_82bb8579f56e397a`, 30 min, 2 devices, key `nxs-2026-01`, Atlas `[ACTIVE]` (only license present). License-key entry removed from the lock overlay; per-case messages (device limit / paused / revoked / expired / …); embedded-license self-heal + auto-recovery via watchdog; `client:build` supersedes prior licenses per customer. 40 tests pass.

### 2026-09-07 — recovery bug fixed
`lock()` hid BOTH `#saas-dashboard` and `#auth-viewport`; on recover (suspend/revoke/limit lifted) the overlay hid but nothing un-hid the login → blank screen. Fix: `license.js` tracks `_wasLocked`; when state becomes OK after a lock it does `window.location.reload()` (fresh boot → license OK → `initSession()` → login). Rebuilt Naveen → `lic_a7f0e5613bd5d086` (`dist-installer/NexusSuite-cus_naveen.exe`, 30m/2). A currently-stuck client just needs an app restart. 40 tests pass.

### 2026-09-07 — running clients adopt the current license after a rebuild
Problem: `client:build` revokes the prior license, so machines on an old build showed "Access Revoked" until reinstalled. Fix: `licenses` rows now store the full signed `.lic` in `signedLicense` (added to model + `issue.js`). `licenseState.evaluate()` online: if this device's license is missing / not ACTIVE, it looks up `License.findOne({customerId, status:ACTIVE})`, `verifyLicense()`s its `signedLicense` (Ed25519 — tamper-safe), and `activate()`s it. So a rebuild propagates to running clients within ~20-40s, no reinstall. Naveen rebuilt → `lic_16e0eb40f00440f3` (`dist-installer/NexusSuite-cus_naveen.exe`, has `signedLicense`). 40 tests pass. NOTE: old builds issued before this change lack `signedLicense`; only builds/licenses from now on self-adopt.

### 2026-09-07 — "HTTP Error 404" at login on some machines
Cause: port 5050 taken by another process on that laptop → our backend fell back to 5051 (server.js EADDRINUSE +1) → the frontend kept POSTing to :5050 (wrong service → 404), and a 404 didn't trigger `api.js` port re-detection. Fix: `api.js request()` — on a bare 404 (`!data.success && !data.code`) it clears the cached `nexus_active_api_port`, re-runs `detectActivePort()` (which verifies `data.service`/`status:'online'`), and retries once against the correct port (`__portRetried` guard). Rebuilt Naveen → `lic_f5cb6bb573f77d66`. 40 tests pass.

### 2026-09-07 — background sync exempt from the license gate
`licenseMiddleware` now lets `/sync/` paths through unconditionally (`/api/sync/*` and `/api/business/sync/*`) even when the license is blocked — so a briefly license-locked device keeps its local store reconciled with the cloud (no data drift). User *actions* (create/update/delete) still hit the gated `/api/business/*` routes, so a locked device still can't write anything new. Verified: sync paths PASS, `/api/business/{invoices,products}` still 402 when blocked. Rebuilt Naveen → `lic_64cedae7816949fc`. 40 tests pass.
NOTE: the two "device IDs" are different systems — license machine hash (`8c452be…`, in `license:list`) vs the app's sync device id (`DEV_…`, in Settings). Not a bug. Settings → Backup & Sync now shows a **"LICENSE DEVICE ID"** row (both settings blocks, `.license-device-id-badge`) = `window.electronAPI.license.getMachineId()`, truncated to 16 chars + full hash on hover, click-to-copy — so an app install can be matched to its `license:list --activations` row. Filled by `license.js fillDeviceIdBadges()` in `initLicensing()`. Rebuilt Naveen → `lic_0aa5435f3b3afdae`.

### 2026-09-07 — Disconnect → logout made reliable
Socket `device:revoked` → `handleUserLogout` already existed but only works if real-time is connected (fails on port-collision machines). Added a polling fallback in `app.js` (30s `setInterval`, only when logged in + online): fetches `api.getRegisteredDevices()`, and if THIS device's `nexus_device_id` is no longer in a non-empty list (after having been seen once, `_sawSelfInDeviceList` guard) → toast + `handleUserLogout(false)`. So clicking "Disconnect" on a device in Settings signs it out within ≤30s even with no socket. Rebuilt Charan → `lic_05478f5e54a10ab6` (20m/2). 40 tests pass.

## 11. Last Updated
2026-09-07 — licensing complete. Live: Kusha lic_946d330176eeb404 (20m, 2 devices). Fresh clean slate (Atlas + dist wiped). npm test = 40.
