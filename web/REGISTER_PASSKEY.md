# Enrolling your passkeys

About ten minutes per device. You do it once per origin *and* once per device, because
**a passkey is bound to the origin it was created on**: a credential enrolled on
`localhost` will not work on `victorgusev.com`, and the laptop's will not work on the
phone.

> **Before anything else: is the code that reads your environment actually deployed?**
> Environment variables are read by whatever build is live, not by what is committed on
> your machine. Setting `PASSKEYS` while the deployed build predates it means the site
> sees **no credentials at all** — and you will not notice, because an existing session
> cookie keeps one device working for up to seven days. This happened on 2026-08-25.
>
> `git status -sb` must not say *ahead*. Push, let Vercel finish, then change variables.

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

   Give the device a name first — *laptop*, *phone*. It is never used in the ceremony;
   it exists so you can tell two base64 blobs apart months later.

   The page then shows **one line, holding every enrolled device**. Copy it into
   `web/.env.local`, replacing any previous value:

   ```
   PASSKEYS=laptop:<credentialId>:<publicKey>,phone:<credentialId>:<publicKey>
   ```

   Replace, never append by hand. The endpoint returns the complete list precisely so
   that adding the phone cannot mean overwriting the laptop — which locks you out of the
   machine you are sitting at.

   `PASSKEY_CREDENTIAL_ID` / `PASSKEY_PUBLIC_KEY` are the old single-device form. They
   are still honoured, so nothing breaks mid-migration, but delete them once `PASSKEYS`
   is set and deployed.

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
| `PASSKEYS` | set after the first production enrolment |
| `PASSKEY_REGISTRATION_SECRET` | temporary, removed in the last step |

`NEXT_PUBLIC_SITE_URL` matters more than it looks — it sets the WebAuthn relying-party ID. If
it disagrees with the browser's actual origin the ceremony fails with an error that explains
nothing.

Redeploy, then repeat steps 2–4 against the live site **for each device you want signed
in** — the phone's ceremony must be run on the phone. Finally **remove
`PASSKEY_REGISTRATION_SECRET` and redeploy again**, and confirm `/signin/register` 404s.

### Check what the site actually accepts

This is the only way to see the deployed truth rather than what Vercel's settings screen
says. It should list one entry per enrolled device:

```bash
curl -s https://victorgusev.com/api/auth/login -H "Origin: https://victorgusev.com"
```

`{"error":"no passkey enrolled"}` means the live build can see **zero** credentials —
either `PASSKEYS` is unset or malformed, or the build predates it. A malformed *entry* is
skipped rather than fatal, so a count that is lower than expected means one entry did not
parse; the server log names it.

## If it fails

| Symptom | Cause |
|---|---|
| Sign-in page says "Not configured" | `SESSION_SECRET` missing or under 32 characters |
| `/signin/register` 404s | `PASSKEY_REGISTRATION_SECRET` unset or under 16 characters |
| "registration is disabled" | the string you pasted does not match the env var |
| "challenge expired" | over five minutes between steps; start again |
| "Cancelled, or the origin does not match" | prompt dismissed, or `NEXT_PUBLIC_SITE_URL` is wrong |
| Sign-in works, `/private` errors on the vault | `GITHUB_TOKEN` missing, expired, or lacking Contents access |
| `"no passkey enrolled"` | the live build sees no credentials — `PASSKEYS` unset, malformed, or not deployed yet |
| One device works, the other does not | that device was never enrolled, or its entry did not parse — run the check above |
| Everything worked, then stopped a week later | a session cookie was masking a broken ceremony; it lasts 7 days |

## Adding, removing, losing a device

**Adding** is the flow above, run on the new device. `PASSKEYS` grows by one entry.

**Removing** is deleting that device's entry from `PASSKEYS` and redeploying. The label is
there to tell you which one to delete. Keep at least one entry, and make sure it is a
device you still have.

**Losing one** of two devices costs nothing: sign in on the other and remove the entry.
This is most of why multiple devices are worth the trouble.

**Losing them all** has no recovery flow, by design — see `DECISIONS.md` D-018 and D-098.
Set `PASSKEY_REGISTRATION_SECRET` again and enrol afresh. Since you control the
environment variables, that is always available to you and to nobody else.
