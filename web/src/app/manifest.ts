import type { MetadataRoute } from "next";

import { GROUND } from "@/lib/brand";

/**
 * The web app manifest — what makes 2ndMind installable on the Samsung (V3 §0.6, D-126).
 *
 * A route rather than a static `public/manifest.json`, because Next's file convention also
 * emits the `<link rel="manifest">` tag itself. One source, no chance of the file and the tag
 * drifting apart.
 *
 * **This does not make it a PWA on its own.** Chrome will offer "Add to Home screen" from a
 * manifest alone, but that produces a bookmark with an icon, not an installed app: no offline
 * shell, no service worker, no update path. §1.1 adds the service worker and turns this into a
 * real install. Authoring it now means the icons can be checked on the real device during
 * Phase 0, which is the point — a launcher icon cannot be judged from a desktop screenshot.
 *
 * Nothing here is sensitive. The manifest is served publicly to anyone who asks, so it carries
 * no more than the site's own pages already do.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "2ndMind",
    short_name: "2ndMind",
    description: "Victor's second brain — logging, training, coursework and applications.",

    // The app opens on the dashboard, not the portfolio. Signed out, this redirects to
    // /signin, which is the correct behaviour rather than an error.
    start_url: "/private",

    // `scope` is what keeps the installed app from swallowing the whole site: tapping an
    // outbound link leaves the app window instead of trapping the portfolio inside it.
    scope: "/",

    display: "standalone",
    orientation: "portrait",

    // Android composes the splash screen itself from these three plus `name` — there is no
    // splash image to author. Both are the ground colour from `globals.css` so the launch
    // screen is continuous with the app rather than flashing white first.
    background_color: GROUND,
    theme_color: GROUND,

    /**
     * The launcher's long-press menu (V3 §3.5, D-178).
     *
     * Three, and each goes straight into a form rather than to a screen you then navigate from
     * — the whole value is arriving with the keyboard up. `context.md` asks that every write
     * path sit under three interactions from the dashboard; from here they are one.
     *
     * Chrome shows at most a handful and honours the order given. Training first because it is
     * the heaviest form and the one timed at under fifteen seconds; the capture box second,
     * chosen over the retired "Log application" when D-159 moved applications to the Sheet;
     * end of day last, because it is the one with a natural time attached.
     *
     * Every target is inside `scope`, and each is a plain URL rather than a route of its own —
     * a second route rendering the same page would be a second thing to keep in step.
     */
    shortcuts: [
      {
        name: "Log training",
        short_name: "Training",
        // Repointed by V4 Phase 2.7. It used to open the quick log's Training tab, which was
        // retired when sessions became writable — the fast path still has to exist, it just
        // arrives somewhere better: a session screen that opens ready for the first exercise.
        url: "/private/athletics/log",
        icons: [{ src: "/icons/shortcut-training.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Quick note",
        short_name: "Note",
        url: "/private?capture=1",
        icons: [{ src: "/icons/shortcut-note.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "End of day",
        short_name: "End of day",
        url: "/private/log?category=day",
        icons: [{ src: "/icons/shortcut-day.png", sizes: "192x192", type: "image/png" }],
      },
    ],

    icons: [
      // `any` — browser tabs, the app switcher, and launchers that do not mask.
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // `maskable` — One UI crops to a squircle and keeps roughly the inner 80%. This variant
      // is full-bleed with the mark held inside that safe circle, which is why it looks
      // over-padded on its own and correct once cropped.
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
