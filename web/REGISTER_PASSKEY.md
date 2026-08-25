# Enrolling your passkey

One-time setup, about ten minutes. You do it twice — once on localhost, once on the live
site — because **a passkey is bound to the origin it was created on**. A credential enrolled
on `localhost` will not work on `victorgusev.com`.

## Before you start

`web/.env.local` needs `SESSION_SECRET` and `GITHUB_TOKEN`. See `.env.example`; generate the
secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Local

1. **Open the gate.** Add to `web/.env.local`, then restart `npm run dev`:

   ```
   PASSKEY_REGISTRATION_SECRET=any-string-at-least-16-characters
   ```

2. **Enrol.** Visit <http://localhost:3000/signin/register>, paste the same string, and press
   *Enrol this device*. Your browser prompts for Touch ID / Windows Hello / your phone.

   The page then shows two lines. Copy them into `web/.env.local`:

   ```
   PASSKEY_CREDENTIAL_ID=...
   PASSKEY_PUBLIC_KEY=...
   ```

3. **Shut the gate.** Delete `PASSKEY_REGISTRATION_SECRET` from `.env.local` and restart.
   Verify — both must be true:

   ```bash
   curl -s -o /dev/null -w "register page: %{http_code}\n" http://localhost:3000/signin/register  # 404
   curl -s -o /dev/null -w "register api:  %{http_code}\n" http://localhost:3000/api/auth/register # 403
   ```

4. **Sign in** at <http://localhost:3000/signin>. You should land on `/private`.

## Production

In Vercel → Settings → Environment Variables, add:

| Variable | Value |
|---|---|
| `SESSION_SECRET` | a **different** random 32-byte hex string from your local one |
| `GITHUB_TOKEN` | the fine-grained PAT (repo `2ndMind`, Contents: read and write) |
| `NEXT_PUBLIC_SITE_URL` | `https://victorgusev.com` |
| `PASSKEY_REGISTRATION_SECRET` | temporary, removed in the last step |

`NEXT_PUBLIC_SITE_URL` matters more than it looks — it sets the WebAuthn relying-party ID. If
it disagrees with the browser's actual origin the ceremony fails with an error that explains
nothing.

Redeploy, then repeat steps 2–4 against the live site. Finally **remove
`PASSKEY_REGISTRATION_SECRET` and redeploy again**, and confirm `/signin/register` 404s.

## If it fails

| Symptom | Cause |
|---|---|
| Sign-in page says "Not configured" | `SESSION_SECRET` missing or under 32 characters |
| `/signin/register` 404s | `PASSKEY_REGISTRATION_SECRET` unset or under 16 characters |
| "registration is disabled" | the string you pasted does not match the env var |
| "challenge expired" | over five minutes between steps; start again |
| "Cancelled, or the origin does not match" | prompt dismissed, or `NEXT_PUBLIC_SITE_URL` is wrong |
| Sign-in works, `/private` errors on the vault | `GITHUB_TOKEN` missing, expired, or lacking Contents access |

## Losing the device

There is no recovery flow, by design — see `DECISIONS.md` D-018. Set
`PASSKEY_REGISTRATION_SECRET` again and re-enrol; the new credential replaces the old one.
Since you control the environment variables, that is always available to you and to nobody
else.
