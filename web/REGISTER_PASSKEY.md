# Enrolling a passkey

Self-serve, since D-234/D-240: visit `/signin/register`, authenticate, done. No env edit,
no redeploy. You do it once per **origin** *and* once per **device** — a passkey is bound to
the origin it was created on, so localhost and `victorgusev.com` need separate ceremonies,
and the laptop's credential does not work on the phone.

## One-time setup, per environment

**Local** (`web/.env.local`) and **production** (Vercel → Settings → Environment Variables)
each need:

| Variable | Value |
|---|---|
| `SESSION_SECRET` | 32+ byte random hex — `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `GITHUB_TOKEN` | fine-grained PAT, repo `2ndMind`, Contents: read and write |
| `DATABASE_URL` | Neon connection string — enrolled devices live in Postgres now |
| `NEXT_PUBLIC_SITE_URL` | `https://victorgusev.com` in production; leave unset locally |
| `PASSKEY_REGISTRATION_SECRET` | any 16+ character string, kept **permanently** — this is the gate, not a per-device value |

`PASSKEY_REGISTRATION_SECRET` is meant to stay set. Save it somewhere durable (a password
manager) — you type the same value on every new device, and unlike the old flow there is no
step where you unset it. Knowing it only opens the registration ceremony; a real WebAuthn
assertion is still required to produce a credential, so it is not a password to the site.

`npm run db:migrate` once, if `passkey_credentials` doesn't exist yet.

## Enrolling a device

1. Visit `/signin/register` (locally: `http://localhost:3000/signin/register`).
2. Paste `PASSKEY_REGISTRATION_SECRET`, name the device (*laptop*, *phone* — only for you to
   tell rows apart later; never used in the ceremony), press **Enrol this device**.
3. Your browser prompts for Touch ID / Windows Hello / your phone's biometric.
4. On success the page confirms the device is enrolled. Sign in immediately at `/signin` —
   nothing else to configure, nothing to copy anywhere.

Repeat per device, on the origin that device will actually sign in to.

## Check what the site actually accepts

```bash
curl -s https://victorgusev.com/api/auth/login -H "Origin: https://victorgusev.com"
```

`{"error":"no passkey enrolled"}` means zero credentials are visible — check
`passkey_credentials` directly, or that the legacy env vars (if you're relying on one) are
still set correctly.

## If it fails

| Symptom | Cause |
|---|---|
| Sign-in page says "Not configured" | `SESSION_SECRET` missing or under 32 characters |
| `/signin/register` 404s | `PASSKEY_REGISTRATION_SECRET` unset or under 16 characters |
| "registration is disabled" | the string you pasted does not match the env var |
| Register page/API says `DATABASE_URL is not set` | Postgres isn't configured — enrolment needs it now |
| "challenge expired" | over five minutes between steps; start again |
| "Cancelled, or the origin does not match" | prompt dismissed, or `NEXT_PUBLIC_SITE_URL` is wrong |
| Sign-in works, `/private` errors on the vault | `GITHUB_TOKEN` missing, expired, or lacking Contents access |
| `"no passkey enrolled"` | nothing in `passkey_credentials` and no legacy env var set |
| One device works, the other does not | that device was never enrolled — run it through `/signin/register` |

## Adding, removing, losing a device

**Adding** is the flow above, run on the new device. It costs one row.

**Removing** is deleting that device's row from `passkey_credentials` — no redeploy needed.
The label is there to tell you which one. Keep at least one, and make sure it is a device you
still have.

**Losing one** of several devices costs nothing: sign in on another and delete the lost one's
row.

**Losing them all** has no recovery flow, by design — see `DECISIONS.md` D-018, D-098, D-240.
`PASSKEY_REGISTRATION_SECRET` stays configured precisely so this stays recoverable: visit
`/signin/register` again and enrol afresh. Since you control the environment variable, that is
always available to you and to nobody else.

## Migrating from the old `PASSKEYS` env var

Nothing to do. `storedCredentials()` still reads `PASSKEYS` / `PASSKEY_CREDENTIAL_ID` /
`PASSKEY_PUBLIC_KEY` alongside the table (D-240), so a device enrolled before this change keeps
working with no action. New devices go straight into `passkey_credentials`; there is no need to
hand-copy the old env value into the table.
