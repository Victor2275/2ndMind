"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

/**
 * Light, dark, or whatever the phone says (V3 §4.2, D-184).
 *
 * Three states rather than two, and **system is one of them rather than the absence of a
 * choice.** A two-way switch has to start somewhere, and whichever way it starts is wrong for
 * half the day — the phone already knows whether it is night, and the useful control is the one
 * that lets you disagree with it in a particular room without disagreeing with it forever.
 *
 * It cycles rather than opening a menu: three states on a bar that is already crowded, operated
 * by a thumb. The label says what it will do next, which is the only way a cycling control is
 * legible without opening it.
 *
 * Nothing sensitive may appear in this file; it compiles into `/_next/static/chunks/`.
 */

/**
 * Whether this is running in a browser yet.
 *
 * `useSyncExternalStore` rather than a `useState` + `useEffect` mount flag: the flag version
 * calls `setState` synchronously inside an effect, which is a cascading render and which
 * `react-hooks/set-state-in-effect` rejects. This says the same thing declaratively — the
 * server snapshot is `false`, the client's is `true`, and the value never changes after.
 */
const NEVER_CHANGES = () => () => {};
const ON_CLIENT = () => true;
const ON_SERVER = () => false;

const ORDER = ["system", "light", "dark"] as const;
type Choice = (typeof ORDER)[number];

const ICON = { system: MonitorIcon, light: SunIcon, dark: MoonIcon };
const LABEL: Record<Choice, string> = {
  system: "Match the phone",
  light: "Light",
  dark: "Dark",
};

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  /**
   * Rendered as nothing until mounted.
   *
   * The server cannot know the theme — it lives in `localStorage` and in the OS — so anything
   * this renders before hydration is a guess, and a guess here is a sun icon flashing to a moon
   * on every single page load. Waiting one paint costs nothing and removes the flicker
   * entirely.
   */
  const ready = useSyncExternalStore(NEVER_CHANGES, ON_CLIENT, ON_SERVER);

  const current: Choice = ORDER.includes(theme as Choice) ? (theme as Choice) : "system";
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  const Icon = ICON[current];

  if (!ready) {
    // A placeholder of the same size, so the row it sits in does not reflow when this appears.
    return <span aria-hidden className={`inline-block size-10 ${className}`} />;
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      // The label names the destination, not the state. "Dark" on a button that is currently
      // dark is the ambiguity every theme toggle has, and it is avoidable by saying so.
      aria-label={`Theme: ${LABEL[current]}. Switch to ${LABEL[next].toLowerCase()}.`}
      title={`Theme: ${LABEL[current]}`}
      className={`flex min-h-10 items-center gap-2 rounded-md px-2 text-muted-foreground transition-colors hover:text-foreground ${className}`}
    >
      <Icon className="size-4" aria-hidden />
      <span className="font-mono text-xs">{LABEL[current]}</span>
    </button>
  );
}
