# NexusSuite Licensing — Operator Guide

Production licensing for the NexusSuite desktop app. **One generic `.exe` for
every customer; the per‑customer `.lic` file carries the expiry.** Duration never
requires rebuilding the app.

> No secrets in this document. Private keys, DB URIs and JWT secrets live only in
> gitignored files on the operator machine / next to the shipped `.exe`.

---

## 1. Architecture (Option A‑lite)

```
tools/license-cli (offline, your machine)
  keygen  -> Ed25519 private key  (kept secret, never shipped)
            Ed25519 public key   (committed in backend/src/licensing/publicKeys.js)
  issue   -> <customer>.lic (signed)  +  a row in the `licenses` Atlas collection

Same ProductionApp.exe  +  <customer>.lic  ->  customer

Desktop app
  ONLINE   : verifies signature + checks the `licenses` row in Atlas
             (status / revocation / expiry / activation limit) + Atlas server time
  OFFLINE  : verifies signature + a DPAPI‑encrypted local vault + monotonic clock,
             within the license's offlineGraceHours and before expiresAt
```

Enforcement is layered: renderer gate → main‑process monotonic watchdog →
`licenseMiddleware` on every protected API → Atlas as the authority.

---

## 2. One‑time setup

```bash
# 1. generate a signing keypair
npm run license:keygen -- nxs-2026-01

# 2. paste the printed PUBLIC key into backend/src/licensing/publicKeys.js  (PUBLIC_KEYS)
#    and set DEFAULT_KEY_ID if this is the primary key

# 3. operator config
cp tools/license-cli/.env.license.example tools/license-cli/.env.license
#   set LICENSE_KEY_ID=nxs-2026-01
#   set LICENSE_ADMIN_MONGO_URI=<your full Atlas connection string>

# 4. shipped runtime secrets (used by the packaged .exe)
cp electron/app.secret.env.example electron/app.secret.env
#   set JWT_SECRET and MONGO_URI
```

Back up `tools/license-cli/keys/<keyId>.private.pem` offline. If it is lost you
can no longer issue or renew licenses for that `keyId` (existing licenses keep
working until they expire).

Gitignored (never commit): `tools/license-cli/keys/`,
`tools/license-cli/.env.license`, `electron/app.secret.env`, `dist-licenses/`,
`*.lic`, `*.private.pem`.

---

## 3. Create a license

```bash
# duration-based
npm run license:issue -- --customer "ABC Clothing" --customer-id cus_abc --duration 30d

# fixed calendar expiry (keep the timezone offset)
npm run license:issue -- --customer "XYZ Store" --customer-id cus_xyz \
  --expires-at 2027-12-31T23:59:59+05:30
```

`--duration` accepts `1h 90m 7d 2w 6mo 1y` (mo = 30d, y = 365d).

Other flags: `--features a,b,c` · `--edition standard` · `--max-activations 2` ·
`--binding soft|strict|none` · `--offline-grace-hours 72` · `--key-id <keyId>` ·
`--not-before <ISO>` · `--out <dir>` · `--no-db` (sign only, no Atlas row → no
revocation possible).

Output: `dist-licenses/<customerId>__<licenseId>.lic` and an `ACTIVE` row in the
`licenses` collection. **Deliver the same installer + this `.lic`.**

---

## 4. Activate (customer side)

Install → the app shows **"Activate this installation"** → paste the `.lic`
contents → the app binds this device (`deviceHash`), registers the activation in
Atlas (if online), writes the encrypted local vault, then shows the normal login.

Device ID shown on the activation screen is a hash — safe to share for support.

---

## 5. Revoke / suspend / extend

```bash
npm run license:revoke -- --license lic_xxx --reason "non-payment"
npm run license:revoke -- --license lic_xxx --suspend
npm run license:revoke -- --license lic_xxx --reactivate

npm run license:extend -- --license lic_xxx --by 30d
npm run license:extend -- --license lic_xxx --expires-at 2027-06-30T23:59:59+05:30
npm run license:extend -- --license lic_xxx --by 30d --reissue   # also emit a new .lic for offline delivery

npm run license:list   -- --activations
npm run license:list   -- --license lic_xxx
```

- **Revoke / suspend**: applied at the client's next online validation (≤ 10 min),
  or immediately if a `license:revoked` socket event reaches it.
- **Extend**: online clients honour the new date automatically
  (`max(signed expiresAt, Atlas expiresAt)`). For offline machines, use
  `--reissue` and send the new `.lic` (same `licenseId`, activation unaffected).
- **Free an activation slot** (device replaced): revoke is not needed — remove the
  activation row for that `deviceHash` (via `license:list --activations` to find
  it, then a small DB update) or raise `--max-activations` on reissue.

---

## 6. Build the production `.exe`

```bash
npm run dist:installer      # -> dist-installer/NexusSuite-Windows-Installer.exe
```

The build runs `scripts/afterPack.cjs`, which **fails** if the package contains a
private key, the license operator env, or a dev license toggle, and **warns** on
embedded Atlas credentials (the accepted single‑tenant trade‑off — see §9).

`electron/app.secret.env` is shipped as `resources/app.secret.env` next to the
exe and read at startup. `LICENSE_ENFORCE` / `LICENSE_FORCE_OFFLINE` are stripped
and `NODE_ENV=production` is pinned in any packaged build, so enforcement cannot
be disabled by editing env files on the client.

Enforcement in **development** is OFF unless `LICENSE_ENFORCE=1`.
`LICENSE_FORCE_OFFLINE=1` forces the offline code path for testing.

---

## 7. Rotate signing keys

1. `npm run license:keygen -- nxs-2027-01`
2. Add the new public key to `publicKeys.js` (keep the old one).
3. Issue new licenses with `--key-id nxs-2027-01` (or set `LICENSE_KEY_ID`).
4. Remove the old public key only after every license signed with it has expired.

---

## 8. Troubleshoot

| Symptom | Cause / fix |
|---|---|
| Activation screen won't accept a key | Wrong `keyId` not in `publicKeys.js`; key already at `maxActivations` (`license:list --activations`); license already `EXPIRED`/`REVOKED`. |
| "License not recognised by the server" | The `.lic` was issued with `--no-db`, or against a different Atlas. Re‑issue without `--no-db`. |
| Locked with "Reconnection Required" | Offline longer than `offlineGraceHours`. Connect once to re‑validate. |
| Locked with "Clock Change Detected" | System clock jumped > 24h vs monotonic time while offline. Connect to re‑validate. |
| Packaged app can't reach the DB | `electron/app.secret.env` missing/incomplete at build time. Restore `MONGO_URI` (and rebuild); the hardcoded fallback in `backend/src/db/connect.js` also applies. |
| Need to reset a customer for testing | Delete `%APPDATA%/invoicepro-desktop/license.vault` on that machine (dev only). |

---

## 9. Known limitations

- **Offline revocation lag**: a machine that stays fully offline keeps working on
  its signed `.lic` until it reconnects or `expiresAt` passes. Immediate remote
  kill is not possible without connectivity.
- **Client‑controlled machine**: the app is not code‑signed or obfuscated in v1,
  so a determined attacker can patch the packaged JS. The design is
  defense‑in‑depth and tamper‑evident, not unbreakable. Authenticode signing is a
  recommended fast‑follow.
- **Single shared Atlas + hardcoded fallback creds** in `backend/src/db/connect.js`
  and the JWT fallback in `authMiddleware.js` — accepted for the single trusted
  customer; a hardened multi‑tenant deployment must provision per‑deployment
  secrets and delete the fallbacks.
- **`authMiddleware` still fails open** for the offline‑token path; licensing
  enforcement does not depend on it, but it should be hardened separately.

---

## 10. Recovery / deactivation

- **Customer got a new PC**: issue is automatic if `binding: soft` and enough
  hardware signals match (re‑bind, no new slot). Otherwise bump
  `--max-activations` on a reissue, or clear the old activation row.
- **Lost private key**: existing licenses keep working to expiry. Generate a new
  keyId, ship an app update that adds its public key, re‑issue on renewal.
- **Suspected key compromise**: `license:revoke` the affected licenses, rotate the
  key (§7), ship an update that removes the old public key.
