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
      <header className="rise">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-highlight">
          Physics 4BL
        </p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight">Labs</h1>
        <p className="mt-3 max-w-[62ch] text-muted-foreground">
          Experimental work where an ESP32 stood in for the bench instruments. Data
          acquisition, signal amplification, curve fitting, and one macro-scale hard-disk
          reader. All are group labs; the work described is mine.
        </p>
      </header>

      <div className="mt-12 space-y-4">
        {labs.map((lab, i) => (
          <Link
            key={lab.slug}
            href={`/labs/${lab.slug}`}
            style={{ animationDelay: `${80 + i * 70}ms` }}
            className="rise card-scan group flex flex-col gap-6 rounded-lg border border-border bg-card/70 p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:flex-row"
          >
            <div className="relative aspect-4/3 w-full shrink-0 overflow-hidden rounded-md border border-border bg-background/60 sm:w-52">
              <Image
                src={`/labs/${lab.heroImage}`}
                alt={`Apparatus diagram for ${lab.title}`}
                fill
                sizes="(max-width: 640px) 100vw, 208px"
                className="object-contain p-2 transition-transform duration-500 ease-out group-hover:scale-105"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="text-lg font-semibold tracking-tight transition-colors group-hover:text-primary">
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
                {lab.imageCount} figures &middot; {lab.groupSize}-person group
              </p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
