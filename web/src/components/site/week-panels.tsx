import { MuscleMap } from "@/components/site/muscle-map";
import { Empty } from "@/components/site/states";
import { HAMMERED_AT, TRAINED_AT, type HeatDay, type MuscleWeek } from "@/lib/athletics/trends";

/**
 * What this week actually trained, and what it missed (V4 Phase 2++ Stage 7, Phase 5.6).
 *
 * Plain SVG and plain markup, rendered on the server like `chart.tsx` — there is nothing
 * interactive here, and a client boundary to draw a figure and a row of squares would be a
 * runtime shipped for no behaviour.
 */

/**
 * The weekly muscle figure — three bands on the drawing Stage 1 redrew.
 *
 * The bands reuse the figure's own three states rather than inventing a third colour: hammered
 * is the prime-mover highlight, trained is the assist, and untrained is the resting grey every
 * unlit region already uses. That is the whole reason it needs no new drawing code.
 *
 * **The legend is not decoration.** Colour never signals alone — a reader who cannot separate
 * the two accent steps gets the same answer from the lists underneath, which name every muscle
 * in each band and give the count that put it there.
 */
export function WeekMuscles({ week }: { week: MuscleWeek }) {
  if (week.sets.size === 0) {
    return <Empty>Nothing logged this week yet — log a session and this fills in.</Empty>;
  }

  const count = (muscle: string) => {
    const value = week.sets.get(muscle) ?? 0;
    // Halves come from secondary muscles; showing "3.5 sets" is more honest than rounding it
    // to a whole number the log does not contain.
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  };

  return (
    <div className="flex flex-wrap items-start gap-6">
      <MuscleMap primary={week.hammered} secondary={week.trained} size={180} />

      <div className="min-w-[12rem] flex-1 space-y-3">
        <div>
          <p className="flex items-center gap-2 eyebrow text-muted-foreground">
            <span aria-hidden className="size-2.5 rounded-full bg-primary" />
            Hammered · {HAMMERED_AT}+ sets
          </p>
          <p className="mt-1 font-mono text-xs text-foreground">
            {week.hammered.length === 0
              ? "—"
              : week.hammered.map((m) => `${m} ${count(m)}`).join(" · ")}
          </p>
        </div>

        <div>
          <p className="flex items-center gap-2 eyebrow text-muted-foreground">
            <span aria-hidden className="size-2.5 rounded-full bg-primary-300" />
            Trained · {TRAINED_AT}–{HAMMERED_AT - 1} sets
          </p>
          <p className="mt-1 font-mono text-xs text-foreground">
            {week.trained.length === 0
              ? "—"
              : week.trained.map((m) => `${m} ${count(m)}`).join(" · ")}
          </p>
        </div>

        <div>
          <p className="flex items-center gap-2 eyebrow text-muted-foreground">
            <span aria-hidden className="size-2.5 rounded-full bg-foreground/45" />
            Untrained
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Everything the figure leaves grey. A secondary muscle counts half a set, so a row trains
            the back and works the biceps.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Five shades, so a hard day and an easy one are distinguishable without a tooltip. */
function heatClass(sets: number): string {
  if (sets === 0) return "bg-foreground/8";
  if (sets < 5) return "bg-primary/25";
  if (sets < 12) return "bg-primary/45";
  if (sets < 20) return "bg-primary/70";
  return "bg-primary";
}

/**
 * The session heatmap (Q405–Q414, Phase 5.6).
 *
 * Columns are weeks and rows are days, the shape every training log uses, because the pattern
 * worth seeing is *which day of the week keeps getting skipped* and that is only visible when
 * the same weekday lines up vertically.
 *
 * Every cell carries its own date and count in a `title` **and** in the accessible label — a
 * heatmap whose only channel is colour says nothing to a screen reader and nothing to anyone
 * counting back to work out which Tuesday they are looking at.
 */
export function SessionHeatmap({ days }: { days: HeatDay[] }) {
  if (days.length === 0) return <Empty>No sessions logged yet.</Empty>;

  // Column-major: seven days per column, so a column is a week and a row is a weekday.
  const columns: HeatDay[][] = [];
  for (let i = 0; i < days.length; i += 7) columns.push(days.slice(i, i + 7));

  const total = days.reduce((sum, day) => sum + day.sets, 0);
  const active = days.filter((day) => day.sets > 0).length;

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="flex gap-1">
          {columns.map((week, index) => (
            <div key={index} className="flex flex-col gap-1">
              {week.map((day) => (
                <span
                  key={day.day}
                  title={`${day.day} · ${day.sets} sets`}
                  aria-label={`${day.day}, ${day.sets} sets`}
                  className={`size-3 rounded-[2px] ${heatClass(day.sets)}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 font-mono text-xs text-muted-foreground">
        <span className="text-foreground">{active}</span> days trained of {days.length} ·{" "}
        <span className="text-foreground">{total}</span> working sets
      </p>
    </div>
  );
}
