"use client";

import { CheckIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { THEMES, themeByName, type Theme } from "@/lib/theme/registry";

/**
 * The five-theme picker, and the switch that hands the choice to the phone (V4 §4.4).
 *
 * Two controls rather than a six-item list, which was Victor's call and is the right one: "match
 * the phone" is a different *kind* of choice from "use Carbon". A list that mixes them makes the
 * app changing colour at sunset look like a bug, because nothing on screen says the OS is
 * driving it. With a switch, the list stays visible while following the phone and marks the
 * theme the OS resolved to — so the answer to "why is it light right now" is on the screen.
 *
 * Works offline: `next-themes` writes to `localStorage` and sets an attribute, with no server in
 * the path. That matters here because `/private/settings` is `force-dynamic` and cannot be
 * reached without a connection at all — see the note in `private-tabbar.tsx` about the offline
 * shell keeping its own theme control.
 *
 * Nothing sensitive may appear in this file; it compiles into `/_next/static/chunks/`.
 */

const NEVER_CHANGES = () => () => {};
const ON_CLIENT = () => true;
const ON_SERVER = () => false;

/** A theme's ground, accent and text, painted from literals rather than from `var(--…)`.
 *
 * A swatch has to show a theme that is *not* the active one, so `var(--primary)` is exactly
 * wrong — it resolves to whatever is applied and paints all five identically. The literals live
 * in the registry and a test pins each one to the generated CSS. */
function Swatch({ theme, selected }: { theme: Theme; selected: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${
        selected ? "border-primary" : "border-border"
      }`}
      style={{ backgroundColor: theme.ground }}
    >
      <span className="flex items-center gap-0.5">
        <span className="size-2.5 rounded-full" style={{ backgroundColor: theme.accent }} />
        <span
          className="size-2.5 rounded-full opacity-70"
          style={{ backgroundColor: theme.foreground }}
        />
      </span>
    </span>
  );
}

export function ThemePicker() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  /**
   * Rendered as a placeholder until mounted.
   *
   * The server cannot know the theme — it is in `localStorage` and in the OS — so anything
   * rendered before hydration is a guess, and a guess here is five rows flickering their
   * selection on every load.
   */
  const ready = useSyncExternalStore(NEVER_CHANGES, ON_CLIENT, ON_SERVER);

  const following = theme === "system";
  // What is actually painted right now. While following the phone this is the theme the OS
  // resolved to, which is the thing the list needs to mark.
  //
  // Kept as the whole entry rather than just its id, because the two are needed for different
  // jobs and mixing them fails silently: the **id** marks the selected row, the **name** is what
  // `setTheme` takes. Passing an id to `setTheme` is a no-op with no error anywhere — a test
  // caught exactly that in the switch below.
  const activeTheme = themeByName(resolvedTheme);
  const active = activeTheme?.id;

  if (!ready) {
    return <div aria-hidden className="h-[19.5rem]" />;
  }

  return (
    <div className="space-y-4">
      <label className="flex cursor-pointer items-center justify-between gap-4">
        <span className="min-w-0">
          <span className="block text-sm font-medium text-foreground">Match the phone</span>
          <span className="mt-0.5 block max-w-[52ch] text-xs leading-relaxed text-muted-foreground">
            Follow the device&rsquo;s light or dark setting. Turn this off to pick a theme yourself.
          </span>
        </span>
        {/* A real checkbox under a drawn switch: it keeps the label association, the keyboard
            behaviour and the focus ring for free, none of which a div with an onClick has.

            The track and the knob are both **siblings** of the input, not nested. Tailwind's
            `peer-checked:` compiles to `.peer:checked ~ &`, so it only ever reaches siblings —
            a knob inside the track silently never moves. */}
        <span className="relative inline-flex size-fit shrink-0">
          <input
            type="checkbox"
            checked={following}
            onChange={(event) =>
              // Turning it off keeps whatever was on screen, rather than snapping to the
              // default — the phone having resolved light should not become dark just because
              // you took the OS out of the decision. `.name`, never `.id`; see above.
              setTheme(event.target.checked ? "system" : (activeTheme?.name ?? "dark"))
            }
            className="peer absolute inset-0 z-10 size-full cursor-pointer appearance-none opacity-0"
          />
          <span
            aria-hidden
            className="block h-7 w-12 rounded-full border border-border bg-muted transition-colors peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute top-1 left-1 size-5 rounded-full bg-faint-foreground transition-transform peer-checked:translate-x-5 peer-checked:bg-primary-foreground"
          />
        </span>
      </label>

      {/* Dimmed but never hidden while following the phone. Hiding it would remove the answer to
          "which one am I actually looking at", which is the question the switch creates. */}
      <ul className={`space-y-2 transition-opacity ${following ? "opacity-55" : "opacity-100"}`}>
        {THEMES.filter((t) => t.selectable).map((entry) => {
          const selected = following ? active === entry.id : theme === entry.name;
          return (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => setTheme(entry.name)}
                aria-current={selected ? "true" : undefined}
                className={`flex min-h-14 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                  selected
                    ? "border-primary/60 bg-primary/10"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <Swatch theme={entry} selected={selected} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{entry.label}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                    {entry.note}
                  </span>
                </span>
                {selected && <CheckIcon className="size-4 shrink-0 text-primary" aria-hidden />}
              </button>
            </li>
          );
        })}
      </ul>

      {following && (
        <p className="text-xs text-faint-foreground">
          The phone is asking for{" "}
          <span className="text-muted-foreground">
            {themeByName(resolvedTheme)?.label ?? "dark"}
          </span>
          .
        </p>
      )}
    </div>
  );
}
