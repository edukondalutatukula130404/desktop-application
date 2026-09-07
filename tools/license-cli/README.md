# License CLI (offline operator tool)

Runs **only on your machine**. Never shipped in the `.exe`, never deployed.
Holds/points at the **private** Ed25519 signing key and your **admin** Atlas URI.

## One-time setup

```bash
# 1. generate a signing keypair
npm run license:keygen -- nxs-2026-01

# 2. paste the printed public key into  backend/src/licensing/publicKeys.js
# 3. copy the env template and fill it in
cp tools/license-cli/.env.license.example tools/license-cli/.env.license
#    set LICENSE_KEY_ID + LICENSE_ADMIN_MONGO_URI
```

Back up `tools/license-cli/keys/<keyId>.private.pem` offline. Losing it means
you can no longer issue or renew licenses for that `keyId`.

## Issuing a license (Phase 2 — not yet implemented)

```bash
npm run license:issue -- --customer "ABC Clothing" --customer-id cus_abc --duration 30d
npm run license:issue -- --customer "XYZ Store" --customer-id cus_xyz --expires-at 2027-12-31T23:59:59+05:30
```

Produces `dist-licenses/<customerId>__<licenseId>.lic` (gitignored) and upserts
the `licenses` row in Atlas. The `.exe` never changes — deliver the same
installer plus the customer's `.lic`.

## Revoke / suspend / extend (Phase 2)

```bash
npm run license:revoke  -- --license lic_xxx --reason "non-payment"
npm run license:extend  -- --license lic_xxx --expires-at 2027-06-30
```

The desktop app applies these on its next online validation (≤ 10 min).
While a machine is fully offline, changes take effect when it reconnects.

## Files

| Path | Purpose |
|---|---|
| `keygen.js` | generate an Ed25519 keypair |
| `lib/keys.js` | key load/generate helpers |
| `lib/sign.js` | build a signed license envelope |
| `keys/` | private + public PEMs (gitignored) |
| `.env.license` | operator config (gitignored) |
