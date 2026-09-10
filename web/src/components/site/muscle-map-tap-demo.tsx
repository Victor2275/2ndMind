"use client";

import { useState } from "react";

import { MuscleMap } from "@/components/site/muscle-map";

/**
 * A kitchen-sink island demonstrating `onRegionTap` (V4 Phase 2++ Stage 1).
 *
 * Cycles a tapped region through primary → secondary → clear, which is the exact behaviour the
 * Stage 4 edit form needs: tap once to make a region the prime mover, again to demote it to
 * assisting, a third time to clear it.
 */
export function MuscleMapTapDemo() {
  const [primary, setPrimary] = useState<string[]>([]);
  const [secondary, setSecondary] = useState<string[]>([]);

  function onRegionTap(muscle: string) {
    if (primary.includes(muscle)) {
      setPrimary((p) => p.filter((m) => m !== muscle));
      setSecondary((s) => [...s, muscle]);
    } else if (secondary.includes(muscle)) {
      setSecondary((s) => s.filter((m) => m !== muscle));
    } else {
      setPrimary((p) => [...p, muscle]);
    }
  }

  return (
    <div className="flex flex-wrap items-start gap-6">
      <MuscleMap primary={primary} secondary={secondary} size={220} onRegionTap={onRegionTap} />
      <div className="flex flex-col gap-2 text-sm">
        <p className="text-muted-foreground">
          Tap a region: first tap sets it primary, second demotes it to secondary, third clears it.
        </p>
        <p>
          <span className="font-medium">Primary:</span> {primary.length ? primary.join(", ") : "—"}
        </p>
        <p>
          <span className="font-medium">Secondary:</span>{" "}
          {secondary.length ? secondary.join(", ") : "—"}
        </p>
      </div>
    </div>
  );
}
