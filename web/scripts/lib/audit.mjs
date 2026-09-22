/**
 * The in-page audits `npm run shots` runs — V4 §7.1 (Q113, Q441, Q446, Q463).
 *
 * Every function here is handed to `page.evaluate`, which serialises it and runs it inside the
 * browser. That has one consequence worth stating at the top, because it looks like bad style
 * until you know it: **each function is entirely self-contained.** They share no helpers and
 * close over nothing, because a reference to anything in this module's scope is `undefined` by
 * the time the function is running in the page. Anything shared has to be duplicated, or passed
 * in as an argument.
 *
 * They live here rather than inline in `shots.mjs` because that file was already 700 lines of
 * sweep, and four more page audits inline would have made the sweep's shape — which pages, at
 * which widths, gated on what — impossible to see.
 *
 * ## What is a fault and what is a reading
 *
 * D-190 is the reason this distinction is now explicit everywhere in this file. `npm run shots`
 * spent the whole of V1–V3 printing tap-target and text-size counts that nothing summed, so a
 * run with sixty-eight too-small elements exited 0 and read as a pass. Every function here
 * returns `offenders` — a list, with enough about each element to find it — rather than a
 * count, and the caller decides what fails. A number on its own cannot be acted on and cannot
 * be gated on honestly.
 */

/**
 * Text below the floor, grouped so the report can be acted on.
 *
 * Q113: an 11px floor, with an allowlist by data attribute. The allowlist is `data-tiny-text`,
 * honoured on the element or any ancestor, and it exists because a handful of places in this
 * app are *correctly* smaller than the floor — a chart's axis labels are the clearest case,
 * where the alternative to 9.6px is not bigger text but fewer labels.
 *
 * An allowlist entry is a decision and should read like one, so the attribute takes a reason as
 * its value: `data-tiny-text="axis labels; bigger means fewer ticks"`. Nothing enforces that the
 * reason is good. What it enforces is that somebody wrote one down.
 *
 * **Leaf elements only.** An element with element children gets its size from whichever child
 * is rendering the text, and counting the parent as well would report one offence twice and
 * make the count depend on how deeply the markup nests.
 */
export function auditText(floorPx) {
  const offenders = [];
  let allowed = 0;

  for (const el of document.querySelectorAll("body *")) {
    if (!el.textContent?.trim()) continue;
    if (el.children.length > 0) continue;

    const px = parseFloat(getComputedStyle(el).fontSize);
    if (!Number.isFinite(px) || px >= floorPx) continue;

    if (el.closest("[data-tiny-text]")) {
      allowed += 1;
      continue;
    }

    offenders.push({
      tag: el.tagName.toLowerCase(),
      cls: (el.className?.toString?.() ?? "").slice(0, 70),
      px: Math.round(px * 10) / 10,
      text: (el.textContent ?? "").trim().slice(0, 24),
    });
  }

  return { offenders, allowed };
}

/**
 * Controls smaller than the tap-target floor.
 *
 * Q441 raises the floor from 40px to 44px, which is the number both Apple and the WCAG 2.2
 * target-size criterion land on. D-190 is why this is now gated rather than printed.
 *
 * **The box measured is not always the element's own.** A 20px icon button inside a 44px
 * padded anchor is fine — the thing your thumb has to hit is the anchor. So an element passes
 * if *it* clears the floor or if its nearest interactive ancestor does. Without that, every
 * icon in the app is a fault and the gate gets switched off within a week.
 *
 * **Both axes, not just height.** The original check read height alone, which passes a 200×20
 * link and a 20×44 one identically. Width matters for the second.
 *
 * The allowlist is `data-small-target`, same shape and same reason as `data-tiny-text`: inline
 * links inside a paragraph are the honest case, because a 44px inline link inside running prose
 * is not a bigger target, it is broken text.
 */
export function auditTap(floorPx) {
  const offenders = [];
  let allowed = 0;

  const SELECTOR = 'a[href], button, input, select, textarea, [role="button"]';

  for (const el of document.querySelectorAll(SELECTOR)) {
    const rect = el.getBoundingClientRect();
    // Nothing rendered has nothing to hit. `type="hidden"`, `display:none` and collapsed
    // panels all land here, and none of them is a tap target.
    if (rect.width === 0 || rect.height === 0) continue;
    if (el.getAttribute("aria-hidden") === "true") continue;
    if (el.hasAttribute("disabled")) continue;

    if (rect.width >= floorPx && rect.height >= floorPx) continue;

    // The hit area a thumb actually gets: the nearest interactive ancestor, if there is one.
    const parent = el.parentElement?.closest(SELECTOR);
    if (parent) {
      const outer = parent.getBoundingClientRect();
      if (outer.width >= floorPx && outer.height >= floorPx) continue;
    }

    // **A link inside a sentence is exempt, and that is WCAG's own exception rather than ours.**
    // Success criterion 2.5.8 excludes a target "in a sentence or block of text", for the
    // reason that the alternative is not a bigger target: padding an inline link to 44px
    // either breaks the line box it sits in or spaces the paragraph out around it. The link is
    // reachable because the text around it is.
    //
    // Detected rather than allowlisted, so it cannot be claimed by a button that merely looks
    // inline: the element's own `display` must be inline, and its parent must contain real text
    // outside the link itself. An `<a>` that is the entire content of its parent is a link
    // standing alone, whatever its display, and stays gated.
    const display = getComputedStyle(el).display;
    if (display === "inline" || display === "inline-flex") {
      const parentText = (el.parentElement?.textContent ?? "").trim();
      const ownText = (el.textContent ?? "").trim();
      if (parentText.length > ownText.length + 2) continue;
    }

    if (el.closest("[data-small-target]")) {
      allowed += 1;
      continue;
    }

    offenders.push({
      tag: el.tagName.toLowerCase(),
      cls: (el.className?.toString?.() ?? "").slice(0, 60),
      w: Math.round(rect.width),
      h: Math.round(rect.height),
      label: (el.getAttribute("aria-label") || el.textContent?.trim() || "").slice(0, 24),
    });
  }

  return { offenders, allowed };
}

/**
 * Heading level order — V4 §7.4 (Q446), deferred here from §4.7.
 *
 * §4.7 audited landmarks and removed nineteen nested `<main>`s, and recorded that heading order
 * had *not* been audited mechanically. This is that audit, and it runs in the sweep rather than
 * as a unit test for the reason the landmark audit did: headings on any given screen come from
 * four or five components that no single test renders together, so the only place the real
 * sequence exists is a rendered page.
 *
 * **A jump down is a fault; a jump up is not.** `h2` → `h4` skips a level and leaves a screen
 * reader's outline with a hole in it. `h4` → `h2` is just the next section starting, which is
 * ordinary and correct. Flagging both is how an audit like this gets a reputation for crying
 * wolf and stops being read.
 *
 * Hidden headings are skipped — `sr-only` ones are not, and should not be, because they are
 * there precisely to be in the outline.
 */
export function auditHeadings() {
  const levels = [];

  for (const el of document.querySelectorAll("h1, h2, h3, h4, h5, h6")) {
    if (el.getAttribute("aria-hidden") === "true") continue;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;

    levels.push({
      level: Number(el.tagName[1]),
      text: (el.textContent ?? "").trim().slice(0, 32),
    });
  }

  const jumps = [];
  for (let i = 1; i < levels.length; i += 1) {
    const from = levels[i - 1].level;
    const to = levels[i].level;
    if (to > from + 1) jumps.push({ from, to, text: levels[i].text });
  }

  // More than one `h1` is the other real outline fault, and it is invisible in a level
  // sequence: `h1, h1` skips nothing.
  const h1s = levels.filter((l) => l.level === 1).length;

  return { count: levels.length, first: levels[0]?.level ?? null, jumps, h1s };
}

/**
 * Text contrast against its own ground — V4 §7.1 (Q463), to Q439's bar.
 *
 * Q439 set the bar at **AA everywhere, AAA for body text**. This checks AA (4.5:1, or 3:1 for
 * large text, which WCAG defines as ≥24px or ≥18.66px bold) and reports the AAA shortfall
 * separately rather than failing on it, because AAA is a target for body prose and not a
 * property of every label on the screen.
 *
 * `tokens.css` is generated from contrast targets and `tokens.test.ts` already checks every
 * token *pair*. This is a different question, and the reason Q463 asks for it: a pair being
 * solvable does not mean the pairs that actually meet on screen are the ones that were solved.
 * Text lands on grounds it was never paired with — a muted label on a raised card inside a
 * tinted panel — and only a rendered page knows which combinations occurred.
 *
 * **The honest limitation, stated rather than hidden.** The ground is found by walking up for
 * the first ancestor with a non-transparent background, which is what the eye does and what the
 * browser does in the common case. It is wrong where text sits over an image or a gradient, and
 * those are reported as `ground: null` and skipped rather than guessed at — a contrast number
 * computed against an assumed white is worse than no number.
 */
export function auditContrast() {
  /**
   * Resolve any CSS colour to sRGB, by asking the browser rather than parsing it.
   *
   * This started as a regex over `rgba(...)` and measured **nothing at all** — zero elements
   * checked on every page, which looked like a clean sweep and was a broken one. The palette is
   * authored in OKLCH and `getComputedStyle` hands back `lab(...)` and `oklch(...)` verbatim in
   * a modern browser; the regex matched none of it and every element was skipped as
   * unparseable. A checker that silently checks nothing is worse than no checker, and it is the
   * same failure D-190 recorded one floor down.
   *
   * A 1x1 canvas handles every colour space the browser does, including ones that do not exist
   * yet, and it composites alpha for free: fill with the ground, fill the text colour over it,
   * read the pixel back.
   */
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  /** `over` is painted underneath first, so a translucent `value` composites onto it. */
  const resolve = (value, over) => {
    if (!value) return null;
    ctx.clearRect(0, 0, 1, 1);
    if (over) {
      ctx.fillStyle = `rgb(${over.r}, ${over.g}, ${over.b})`;
      ctx.fillRect(0, 0, 1, 1);
    }
    // An unparseable value leaves `fillStyle` at whatever it was, so it is set to a sentinel
    // first and the assignment is checked — otherwise a typo reads as solid black.
    ctx.fillStyle = "#ff00ff";
    ctx.fillStyle = value;
    if (ctx.fillStyle === "#ff00ff" && value.replace(/\s/g, "") !== "#ff00ff") return null;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return { r, g, b, a: a / 255 };
  };

  const luminance = ({ r, g, b }) => {
    const channel = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };

  const offenders = [];
  let unknown = 0;
  let checked = 0;

  /**
   * The ground a piece of text is actually painted on.
   *
   * Walks up compositing every background it passes until the stack is opaque, **including
   * `<html>`** — which is where this app's ground actually lives, because `globals.css` keeps
   * `body` transparent so the ambient layer can sit between the two. Stopping at `body`, as
   * this did first, found `rgba(0,0,0,0)` on every page and reported the whole app as
   * unmeasurable.
   */
  const groundFor = (el) => {
    const stack = [];
    for (let node = el; node; node = node.parentElement) {
      const bg = getComputedStyle(node).backgroundColor;
      const colour = resolve(bg);
      if (colour && colour.a > 0) stack.push(colour);
      if (colour && colour.a >= 1) break;
    }
    if (stack.length === 0) return null;

    // Composite from the bottom of the stack up. The deepest opaque layer is last.
    let out = stack[stack.length - 1];
    if (out.a < 1) return null;
    for (let i = stack.length - 2; i >= 0; i -= 1) {
      const composited = resolve(
        `rgba(${stack[i].r}, ${stack[i].g}, ${stack[i].b}, ${stack[i].a})`,
        out,
      );
      if (composited) out = composited;
    }
    return out;
  };

  for (const el of document.querySelectorAll("body *")) {
    // Elements whose `textContent` is code rather than words. `SCRIPT` was the first leaf on
    // every page and is not text anybody reads.
    if (el.tagName === "SCRIPT" || el.tagName === "STYLE" || el.tagName === "NOSCRIPT") continue;
    if (!el.textContent?.trim()) continue;
    if (el.children.length > 0) continue;

    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") continue;
    if (parseFloat(style.opacity) === 0) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    const ground = groundFor(el);
    if (!ground) {
      unknown += 1;
      continue;
    }

    // **Invisible text is not low-contrast text.** `text-transparent` is a real technique in
    // this app — the routine checklist's tick is transparent until the row is ticked, and the
    // exercise picker uses the same trick for its check glyph — and compositing a fully
    // transparent colour onto its ground gives 1:1, which this reported as the worst contrast
    // failure on the page. It is not a failure; there is nothing there to read. Checked before
    // compositing, because compositing is what destroys the alpha.
    const raw = resolve(style.color);
    if (!raw) {
      unknown += 1;
      continue;
    }
    if (raw.a < 0.05) continue;

    // Resolved *over its own ground*, so a translucent text colour is composited rather than
    // compared as if it were opaque.
    const text = resolve(style.color, ground);
    if (!text) {
      unknown += 1;
      continue;
    }

    checked += 1;
    const px = parseFloat(style.fontSize);
    const weight = Number(style.fontWeight) || 400;
    const large = px >= 24 || (px >= 18.66 && weight >= 700);

    const l1 = luminance(text);
    const l2 = luminance(ground);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

    const floor = large ? 3 : 4.5;
    if (ratio < floor) {
      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className?.toString?.() ?? "").slice(0, 60),
        ratio: Math.round(ratio * 100) / 100,
        need: floor,
        px: Math.round(px * 10) / 10,
        text: (el.textContent ?? "").trim().slice(0, 24),
      });
    }
  }

  return { offenders, checked, unknown };
}
