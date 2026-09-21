import { SparklesIcon } from "lucide-react";

import { Panel } from "@/components/site/page-shell";

/**
 * An AI summary, shown as what it is (V4 §5.4, Q388, Q389, Q378).
 *
 * Three answers land in one component, and they are all about weight rather than content:
 *
 * - **Marked as machine-written** (Q388), with the model name kept. The mark is a glyph *and*
 *   the model string, never the glyph alone — a sparkle on its own is decoration that happens
 *   to mean something, and rule 10 says colour and iconography never signal by themselves.
 * - **Quieter than a data panel** (Q389). `tone="quiet"` softens the surface; the body text is
 *   `muted-foreground` rather than `foreground`. A sentence a model wrote about a day Victor
 *   lived is the least authoritative thing on the page and should read that way.
 * - **Closed by default** (Q378). It is a reflection, not an instruction, and Today opens with
 *   five panels above it. Opening is one tap and native `<details>` remembers nothing, which is
 *   correct here: the answer to "do I want to read yesterday's summary" is not sticky.
 *
 * The same component renders the archive's rows, so a stored summary and a fresh one cannot
 * drift apart visually — the archive is the same thing, later.
 */
export function SummaryPanel({
  title,
  model,
  text,
  defaultOpen = false,
}: {
  title: string;
  /** Empty for a row stored before `recordSummary` kept the model (it has always kept it). */
  model: string;
  text: string;
  defaultOpen?: boolean;
}) {
  return (
    <Panel
      title={title}
      tone="quiet"
      collapsible
      defaultOpen={defaultOpen}
      meta={<MachineMark model={model} />}
    >
      <div className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
        {text}
      </div>
    </Panel>
  );
}

/**
 * The mark itself, exported because the archive heads its list with one rather than repeating
 * it on every row.
 *
 * `aria-hidden` on the glyph and the model name as real text: a screen reader hears "written by
 * gemini-2.5-flash", which is the whole message. The glyph is for the eye that is scanning.
 */
export function MachineMark({ model }: { model: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-faint-foreground">
      <SparklesIcon aria-hidden className="size-3" />
      <span className="sr-only">Written by </span>
      <span className="font-mono">{model || "a model"}</span>
    </span>
  );
}
