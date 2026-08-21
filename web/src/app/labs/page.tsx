import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { publicLabs } from "@/lib/vault/public";

export const metadata = {
  title: "Labs",
  description:
    "ESP32 instrumentation and data-acquisition work from UCLA Physics 4BL — signal processing, circuit characterization, and a working hard-disk-reader analog.",
};

export default function LabsPage() {
  const labs = publicLabs();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
      <h1 className="text-4xl font-extrabold tracking-tight">Labs</h1>
      <p className="mt-3 max-w-[62ch] text-muted-foreground">
        Experimental work from UCLA Physics 4BL, where an ESP32 stood in for the bench
        instruments. Data acquisition, signal amplification, curve fitting, and one
        macro-scale hard-disk reader. All are group labs; collaborators are credited on
        each.
      </p>

      <div className="mt-12 space-y-px border border-border bg-border">
        {labs.map((lab) => (
          <Link
            key={lab.slug}
            href={`/labs/${lab.slug}`}
            className="group flex flex-col gap-6 bg-background p-6 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring sm:flex-row"
          >
            <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded border border-border bg-accent sm:w-56">
              <Image
                src={`/labs/${lab.heroImage}`}
                alt={`Apparatus diagram for ${lab.title}`}
                fill
                sizes="(max-width: 640px) 100vw, 224px"
                className="object-contain p-2"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="text-lg font-semibold tracking-tight group-hover:text-primary">
                  {lab.title}
                </h2>
                <span className="tabular shrink-0 font-mono text-xs text-muted-foreground">
                  {lab.date}
                </span>
              </div>

              <p className="mt-2 text-sm text-muted-foreground">{lab.summary}</p>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {lab.stack.map((s) => (
                  <Badge key={s} variant="secondary" className="text-[0.65rem]">
                    {s}
                  </Badge>
                ))}
              </div>

              <p className="mt-3 font-mono text-[0.68rem] text-muted-foreground">
                {lab.imageCount} figures &middot; with {lab.collaborators.join(", ")}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
