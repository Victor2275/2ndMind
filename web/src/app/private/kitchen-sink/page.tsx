import type { ReactNode } from "react";

import { ArrowRightIcon, CheckIcon, TriangleAlertIcon } from "lucide-react";

import { PageHeader, Panel } from "@/components/site/page-shell";
import { SheetDemo } from "@/components/site/sheet-demo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { THEMES } from "@/lib/theme/registry";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Kitchen sink",
  robots: { index: false, follow: false },
};

/**
 * Every component, every state, every theme, on one page (V4 §1.11, Q24, D-201).
 *
 * ## Why it is a route and not a Storybook
 *
 * The budget is $0 and the question Q24 actually asked was "is a component gallery worth
 * building to review every component in both themes at once" — *reviewing* is the job, not
 * isolating components for development. A route renders under the app's real stylesheet, the
 * real fonts, the real ambient layer and the real theme attribute, which is exactly the context
 * a review needs and the one a Storybook iframe has to reconstruct.
 *
 * ## The trick that makes "every theme at once" work
 *
 * `tokens.css` scopes each palette with `[data-theme="…"]`, an attribute selector — not
 * `html[data-theme="…"]`. Custom properties inherit, so putting the attribute on a `<section>`
 * re-declares the whole palette for that subtree. Five themes therefore render side by side on
 * one page, in one browser, with no iframes.
 *
 * Two consequences worth knowing before editing:
 *
 *   - A themed block **must** set `bg-background text-foreground` itself. `<html>` paints the
 *     page ground (`globals.css` keeps `body` transparent so the ambient layer can sit between
 *     them), so a nested theme that does not paint its own ground shows the *outer* theme's.
 *   - Tailwind's `dark:` variant is a generated descendant selector over the dark-family themes
 *     (`[data-theme="carbon"] *`, and so on), so it resolves correctly inside a nested block
 *     too. That is worth checking here whenever the generator changes, because this page is the
 *     only place in the app where two schemes are on screen together.
 *
 * ## Why it is not in the navigation
 *
 * `PrivateNav` is already eight items and a scrolling row at 1440px (§4.1), and C11 — whether
 * nine private routes is the right number — is still open in the plan's §8. A review tool used
 * a handful of times per phase does not get to be the ninth. It is reachable by URL, and
 * `npm run shots` sweeps it so it cannot rot silently.
 */

/* --------------------------------------------------------------------------------------------
   Small local presentation helpers. Deliberately local: they exist to caption a gallery and
   would be noise anywhere else in the app.
   -------------------------------------------------------------------------------------------- */

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-border py-3 first:border-t-0">
      <span className="w-32 shrink-0 eyebrow text-faint-foreground">{label}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/** A caption in the mono face, because everything in one is a number, a token name or a path. */
function Spec({ children }: { children: ReactNode }) {
  return <span className="font-mono text-xs text-faint-foreground">{children}</span>;
}

/**
 * Every class name below is written out in full, on purpose.
 *
 * Tailwind finds classes by scanning source text for complete strings — it does not evaluate
 * the code. `` className={`text-${step}`} `` therefore generates **nothing**, and the element
 * renders at the inherited size with no error anywhere: the page looks plausible and every
 * caption lies. That is a bad failure for any page and a disqualifying one for this page, whose
 * whole job is to be the thing you check the scale against.
 *
 * So the tables carry the literal class as data. The duplication between the label and the
 * class is the price of the class being visible to the scanner.
 */
const TYPE_STEPS = [
  ["text-5xl", "5xl", "48.00px", "fluid · hand-adjusted from 47.77px"],
  ["text-4xl", "4xl", "39.81px", "fluid"],
  ["text-3xl", "3xl", "33.18px", "fluid"],
  ["text-2xl", "2xl", "27.65px", "fluid"],
  ["text-xl", "xl", "23.04px", "stepped"],
  ["text-lg", "lg", "19.20px", "stepped"],
  ["text-base", "base", "16.00px", "stepped · the anchor"],
  ["text-sm", "sm", "13.33px", "stepped · 228 call sites"],
  ["text-xs", "xs", "11.11px", "stepped · clears the 11px floor"],
] as const;

/** The eight spacing values. Width comes from an inline `var()`, so no class is needed. */
const SPACE_STEPS = ["3xs", "2xs", "xs", "sm", "md", "lg", "xl", "2xl"] as const;

const RADII = [
  ["rounded-control", "control"],
  ["rounded-card", "card"],
  ["rounded-panel", "panel"],
  ["rounded-sheet", "sheet"],
  ["rounded-pill", "pill"],
] as const;

const ELEVATIONS = [
  ["shadow-rest", "rest"],
  ["shadow-raised", "raised"],
  ["shadow-floating", "floating"],
  ["shadow-overlay", "overlay"],
] as const;
const BUTTON_VARIANTS = [
  "default",
  "outline",
  "secondary",
  "ghost",
  "destructive",
  "link",
] as const;
const BADGE_VARIANTS = ["default", "secondary", "destructive", "outline", "ghost", "link"] as const;

/**
 * The token roles a swatch strip shows, per theme.
 *
 * Grounds first, then text, then accents — the order the generator solves them in, so a strip
 * that looks wrong can be read against `build-tokens.mts` top to bottom.
 */
const SWATCHES = [
  ["background", "bg-background"],
  ["surface", "bg-surface"],
  ["raised", "bg-raised"],
  ["foreground", "bg-foreground"],
  ["muted-foreground", "bg-muted-foreground"],
  ["faint-foreground", "bg-faint-foreground"],
  ["primary", "bg-primary"],
  ["secondary", "bg-secondary"],
  ["highlight", "bg-highlight"],
  ["success", "bg-success"],
  ["warning", "bg-warning"],
  ["destructive", "bg-destructive"],
  ["border", "bg-border"],
  ["ring", "bg-ring"],
] as const;

const RAMP = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

/** Everything a component gallery shows, rendered inside whichever theme wraps it. */
function Gallery() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Row label="Swatches">
          <div className="flex flex-wrap gap-1">
            {SWATCHES.map(([name, cls]) => (
              <span
                key={name}
                title={name}
                className={`${cls} h-7 w-7 rounded-control border border-border`}
              />
            ))}
          </div>
        </Row>
        <Row label="Primary ramp">
          <div className="flex flex-wrap">
            {RAMP.map((stop) => (
              <span
                key={stop}
                title={`primary-${stop}`}
                className="h-7 w-7"
                style={{ background: `var(--primary-${stop})` }}
              />
            ))}
          </div>
        </Row>
      </div>

      <div>
        <Row label="Button">
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant}>
              {variant}
            </Button>
          ))}
        </Row>
        <Row label="Button · sizes">
          <Button size="xs">xs</Button>
          <Button size="sm">sm</Button>
          <Button size="default">default</Button>
          <Button size="lg">lg</Button>
          <Button size="icon-xs">
            <CheckIcon />
          </Button>
          <Button size="icon-sm">
            <CheckIcon />
          </Button>
          <Button size="icon">
            <CheckIcon />
          </Button>
          <Button size="icon-lg">
            <CheckIcon />
          </Button>
        </Row>
        <Row label="Button · states">
          <Button disabled>disabled</Button>
          <Button aria-invalid>aria-invalid</Button>
          <Button>
            with icon <ArrowRightIcon />
          </Button>
        </Row>
      </div>

      <div>
        <Row label="Badge">
          {BADGE_VARIANTS.map((variant) => (
            <Badge key={variant} variant={variant}>
              {variant}
            </Badge>
          ))}
        </Row>
      </div>

      <div>
        <Row label="Card · sm/md/lg">
          {(["sm", "md", "lg"] as const).map((size) => (
            <Card key={size} size={size} className="w-52">
              <CardHeader>
                <CardTitle>Card {size}</CardTitle>
                <CardDescription>Padding from the spacing vocabulary.</CardDescription>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                Elevation is <code>shadow-raised</code>: a ring on dark, a shadow on light.
              </CardContent>
            </Card>
          ))}
        </Row>
      </div>

      <div>
        <Row label="Input">
          <div className="w-64">
            <Label htmlFor={`ks-input`}>Label</Label>
            <Input id="ks-input" placeholder="Placeholder" className="mt-1" />
          </div>
          <Input placeholder="Disabled" disabled className="w-40" />
          <Input placeholder="Invalid" aria-invalid className="w-40" />
        </Row>
        <Row label="Textarea">
          <Textarea placeholder="Textarea" className="w-64" />
        </Row>
      </div>

      <div>
        <Row label="Skeleton">
          <div className="w-64 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </Row>
        <Row label="Sheet">
          <SheetDemo side="bottom" />
          <SheetDemo side="right" />
        </Row>
      </div>

      <div>
        <Row label="Elevation">
          {ELEVATIONS.map(([cls, level]) => (
            <span key={level} className={`${cls} rounded-card bg-surface px-4 py-3 text-xs`}>
              {level}
            </span>
          ))}
        </Row>
        <Row label="Radius">
          {RADII.map(([cls, name]) => (
            <span key={name} className={`${cls} border border-border bg-surface px-3 py-2 text-xs`}>
              {name}
            </span>
          ))}
        </Row>
      </div>

      <div>
        <Row label="Eyebrow">
          <span className="eyebrow text-primary">page title eyebrow</span>
          <span className="eyebrow text-muted-foreground">stat label</span>
          <span className="eyebrow text-faint-foreground">metadata</span>
        </Row>
        <Row label="Mono · real data">
          <Spec>2026-09-08 · 1:58.4 · 142.5 kg · src/app/page.tsx</Spec>
        </Row>
      </div>

      <div>
        <Row label="card-scan">
          <span className="card-scan rounded-card border border-border bg-card px-4 py-3 text-xs">
            hover me — sweep, no lift
          </span>
        </Row>
        <Row label="link-wipe">
          <a href="#top" className="link-wipe text-sm text-primary">
            navigational link
          </a>
        </Row>
        <Row label="press">
          <button
            type="button"
            className="press rounded-control border border-border bg-surface px-4 py-2 text-sm"
          >
            hold me
          </button>
        </Row>
        <Row label="shimmer">
          <span className="shimmer h-8 w-40 rounded-control bg-muted" />
        </Row>
        <Row label="rise-stagger">
          <div className="flex rise-stagger gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                key={n}
                className="rounded-control border border-border bg-surface px-3 py-2 text-xs"
              >
                {n}
              </span>
            ))}
          </div>
        </Row>
      </div>

      <div>
        <Row label="Icons">
          <span className="flex items-center gap-2">
            <CheckIcon className="icon-sm" /> <Spec>icon-sm · 16px</Spec>
          </span>
          <span className="flex items-center gap-2">
            <CheckIcon className="icon-md" /> <Spec>icon-md · 20px</Spec>
          </span>
          <span className="flex items-center gap-2">
            <CheckIcon className="icon-lg" /> <Spec>icon-lg · 24px</Spec>
          </span>
          <span className="flex items-center gap-2 text-warning">
            <TriangleAlertIcon className="icon-md" /> <Spec>stroke 1.75</Spec>
          </span>
        </Row>
      </div>
    </div>
  );
}

export default function KitchenSinkPage() {
  return (
    <div className="flex flex-col gap-8" id="top">
      <PageHeader
        eyebrow="V4 §1.11"
        title="Kitchen sink"
        lede="Every component, every state, every theme. Each block below sets data-theme on itself, so the five palettes render side by side in one browser — the attribute selectors in tokens.css are not scoped to <html>."
      />

      {/* Type, space and radius are theme-independent (they come from `scale.css`), so they are
          shown once rather than five times. Showing them per theme would imply they vary. */}
      <Panel title="Type scale" meta="9 steps · ratio 1.2 · base 1rem">
        <div className="flex flex-col gap-1">
          {TYPE_STEPS.map(([cls, step, px, note]) => (
            <div key={step} className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className={`${cls} font-heading`}>Instrument, not a document</span>
              <Spec>
                {cls} · {px} · {note}
              </Spec>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Space" meta="8 values · 4-point grid">
        <div className="flex flex-col gap-2">
          {SPACE_STEPS.map((name) => (
            <div key={name} className="flex items-center gap-3">
              <span className="h-3 bg-primary" style={{ width: `var(--spacing-${name})` }} />
              <Spec>--spacing-{name}</Spec>
            </div>
          ))}
        </div>
      </Panel>

      {/* One block per theme. `data-theme` on the section re-declares the whole palette for its
          subtree; `bg-background text-foreground` is what makes it paint its own ground rather
          than showing the page's. */}
      {THEMES.map((theme) => (
        <section
          key={theme.id}
          data-theme={theme.id}
          className="rounded-panel border border-border bg-background p-5 text-foreground"
        >
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2">
            <h2 className="text-lg font-semibold">{theme.label}</h2>
            <Spec>
              {theme.id} · {theme.scheme} · {theme.ground}
            </Spec>
          </div>
          <Gallery />
        </section>
      ))}
    </div>
  );
}
