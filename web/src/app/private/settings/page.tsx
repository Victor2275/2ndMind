import { InstallButton } from "@/components/site/install-button";
import { PageHeader } from "@/components/site/page-shell";
import { PublicSiteLink } from "@/components/site/public-site-link";
import { PushToggle } from "@/components/site/push-toggle";
import { SettingsGroup, SettingsRow, SettingsValue } from "@/components/site/settings-shell";
import { SettingsSync } from "@/components/site/settings-sync";
import { SignOutButton } from "@/components/site/sign-out-button";
import { ThemePicker } from "@/components/site/theme-picker";
import { publicKey } from "@/lib/push/config";
import { THEMES } from "@/lib/theme/registry";

/**
 * Settings (V4 §4.4).
 *
 * The rule Victor gave for what belongs here (Q371): **anything that affects the website and is
 * not used regularly.** Everything on this page came out of the phone's More sheet or the
 * desktop nav row, and those two places no longer carry any of it — one home per control, so
 * they cannot drift apart.
 *
 * Q375 asked specifically for manual sync to stop living in More; it is here, under Sync.
 *
 * **Not reachable offline, and that is not a bug to fix here.** Everything under `/private` is
 * `force-dynamic` and needs a session checked on a server, so the worker serves `/cached` for a
 * failed navigation. The one control that genuinely works without a network — the theme — is
 * therefore kept in the offline shell's own menu; see the note in `private-tabbar.tsx`.
 */

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

/**
 * The deployed commit.
 *
 * Vercel sets `VERCEL_GIT_COMMIT_SHA`; a local `next dev` sets nothing, and saying "local" is
 * more honest than the alternatives — a build with no commit is not version zero, it is a build
 * whose version is not a commit. `scripts/build-sw.mjs` derives the service worker's id the same
 * way, which is why the two normally agree.
 */
function deployedCommit(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  return sha ? sha.slice(0, 12) : "local";
}

export default function SettingsPage() {
  return (
    <main className="max-w-2xl pb-16">
      <PageHeader
        eyebrow="Settings"
        title="Settings"
        lede="Everything that changes how the app behaves. Nothing here is needed day to day."
      />

      <div className="mt-8">
        <SettingsGroup
          title="Appearance"
          note="Five palettes. Every colour in each was solved for a contrast ratio rather than picked, so all of them are legible — the choice is only which one you want to look at."
        >
          {/* No row label: the picker's own "Match the phone" heading is the first thing in it,
              and "Appearance / Theme / Match the phone" is three headings for one setting. */}
          <SettingsRow>
            <ThemePicker />
          </SettingsRow>
        </SettingsGroup>

        <SettingsGroup title="Notifications">
          <SettingsRow
            label="Notify"
            note="A morning list and an evening nudge. Never asked for on its own — the browser only gives one prompt and a denial is hard to reverse, so it waits for this button."
            control={<PushToggle publicKey={publicKey()} />}
          />
        </SettingsGroup>

        <SettingsGroup
          title="Sync"
          note="Everything written on this device is kept locally until the server has it. Nothing is ever discarded."
        >
          {/* Likewise: the control is a button that says "Send now", so a row labelled the same
              thing is the label stuttering at its own control. */}
          <SettingsRow>
            <SettingsSync />
          </SettingsRow>
        </SettingsGroup>

        <SettingsGroup title="This device">
          <SettingsRow
            label="Install the app"
            note="Adds it to the home screen. Shows nothing when the browser has nothing to offer — already installed, or not supported."
            control={<InstallButton />}
          />
          <SettingsRow
            label="Add a passkey"
            note="Enrol another device. The credential goes into an environment variable, so this also needs a paste into Vercel afterwards."
            control={
              <a
                href="/signin/register"
                className="flex min-h-10 items-center rounded-md border border-border px-3 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                Register
              </a>
            }
          />
        </SettingsGroup>

        <SettingsGroup title="Account">
          <SettingsRow
            label="Public site"
            note="The portfolio. Opens in the same tab."
            control={<PublicSiteLink className="min-h-10 px-1 text-sm" />}
          />
          <SettingsRow
            label="Sign out"
            note="Ends the session on this device and forgets the cached passkey."
            control={<SignOutButton />}
          />
        </SettingsGroup>

        <SettingsGroup
          title="About"
          note="For when something looks stale and you need to know which build you are looking at."
        >
          <SettingsRow
            label="Deployed commit"
            control={<SettingsValue>{deployedCommit()}</SettingsValue>}
          />
          <SettingsRow
            label="Themes available"
            control={<SettingsValue>{THEMES.length}</SettingsValue>}
          />
          <SettingsRow
            label="Not sent yet"
            note="The full queue, with the reason each entry is still waiting."
            control={
              <a
                href="/private/sync"
                className="flex min-h-10 items-center rounded-md border border-border px-3 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                Open
              </a>
            }
          />
        </SettingsGroup>
      </div>
    </main>
  );
}
