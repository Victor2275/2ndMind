import { DownloadIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { resumeUpload } from "@/lib/resume-pdf";
import { buildResume, RESUME_VARIANTS } from "@/lib/resume";
import type { ResumeVariant } from "@/lib/vault/schemas";

export function generateStaticParams() {
  return RESUME_VARIANTS.map((variant) => ({ variant }));
}

function isVariant(value: string): value is ResumeVariant {
  return (RESUME_VARIANTS as string[]).includes(value);
}

export async function generateMetadata({ params }: PageProps<"/resume/[variant]">) {
  const { variant } = await params;
  if (!isVariant(variant)) return {};
  const doc = buildResume(variant);
  return {
    title: `Resume — ${doc.label}`,
    description: doc.headline,
  };
}

export default async function ResumePage({ params }: PageProps<"/resume/[variant]">) {
  const { variant } = await params;
  if (!isVariant(variant)) notFound();

  const doc = buildResume(variant);
  const upload = resumeUpload(variant);
  // Every variant, always, in the order declared by RESUME_VARIANTS -- robotics, ml, swe.
  // Before this it rendered only the *other* two, so the row re-ordered itself on every
  // switch and the control moved out from under the cursor.
  const variants = RESUME_VARIANTS.map((v) => ({
    id: v,
    label: buildResume(v).label,
    current: v === variant,
  }));

  return (
    <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      {/* Controls — screen only. */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow text-muted-foreground">Variant</span>
          {variants.map((v) =>
            v.current ? (
              <span
                key={v.id}
                aria-current="page"
                className="rounded-full border border-primary bg-primary px-3 py-1 font-mono text-xs text-primary-foreground"
              >
                {v.label}
              </span>
            ) : (
              <Link
                key={v.id}
                href={`/resume/${v.id}`}
                className="rounded-full border border-border px-3 py-1 font-mono text-xs text-muted-foreground transition-all duration-250 hover:-translate-y-0.5 hover:border-primary/60 hover:text-foreground"
              >
                {v.label}
              </Link>
            ),
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* The single download action (Q352). Was a "Download PDF" upload button sitting
              beside a "Print / Save as PDF" button — two ways to get a PDF read as one too
              many, so Print was dropped and this is now the only download on the page. The
              size is still stated, because a download that starts without warning is one
              nobody chose. */}
          {upload && (
            <a
              href={upload.url}
              download
              className="inline-flex items-center gap-2 rounded-control bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity duration-fast ease-standard hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <DownloadIcon className="icon-sm" aria-hidden />
              Download PDF
              <span className="tabular font-mono text-xs opacity-70">
                {Math.round(upload.bytes / 1024)} KB
              </span>
            </a>
          )}
        </div>
      </div>

      {/* The sheet, as a document rather than a print preview on a dark page (Q347, Q348).
          `shadow-floating` is doing the work Q354 asked for and needs no theme branch: elevation
          is a real shadow in light themes and a ground-shift plus border in dark ones
          (DESIGN.md §6), so the paper edge appears on paper and not on near-black, which is
          exactly the rule Q354 states.

          Padding reflows (Q349). `p-8` on a 360px screen spends 64px of a 360px viewport on
          margin, which is what made the phone version a Letter sheet scaled down.

          @media print in globals.css is untouched and stays frozen (Q355, V4 rule 5). */}
      <article className="resume-sheet rounded-card border border-border bg-card p-5 shadow-floating phone:p-8 tablet:p-10 print:shadow-none">
        <header className="resume-block">
          <h1 className="text-3xl font-extrabold tracking-tight">{doc.name}</h1>
          <p className="mt-2 max-w-[70ch] text-sm text-muted-foreground">{doc.headline}</p>
          <p className="resume-contact mt-3 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-muted-foreground">
            <a href={`tel:${doc.contact.phone.replace(/[^\d+]/g, "")}`}>{doc.contact.phone}</a>
            <span aria-hidden>·</span>
            <a href={`mailto:${doc.contact.email}`}>{doc.contact.email}</a>
            <span aria-hidden>·</span>
            <a href={doc.contact.linkedin}>linkedin.com/in/victorgusev</a>
            <span aria-hidden>·</span>
            <a href={doc.contact.github}>github.com/Victor2275</a>
          </p>
        </header>

        <section className="resume-block mt-7">
          <h2 className="resume-heading">Education</h2>
          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-6">
            <p className="text-sm font-semibold text-foreground">{doc.education.school}</p>
            <p className="tabular font-mono text-xs text-muted-foreground">
              Expected {doc.education.graduation}
            </p>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-6">
            <p className="text-sm text-muted-foreground">{doc.education.degree}</p>
            <p className="tabular font-mono text-xs text-muted-foreground">
              GPA {doc.education.gpa}
            </p>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            <span className="italic">Coursework: </span>
            {doc.education.coursework.join(", ")}
          </p>
        </section>

        <section className="resume-block mt-7">
          <h2 className="resume-heading">Technical Skills</h2>
          <dl className="mt-2 space-y-1">
            {doc.skills.map((s) => (
              <div key={s.group} className="flex flex-wrap gap-x-2 text-xs">
                <dt className="font-semibold text-foreground">{s.group}:</dt>
                <dd className="text-muted-foreground">{s.items.join(", ")}</dd>
              </div>
            ))}
          </dl>
        </section>

        {(
          [
            ["Experience", doc.experience],
            ["Projects", doc.projects],
          ] as const
        ).map(([heading, entries]) =>
          entries.length === 0 ? null : (
            <section key={heading} className="mt-7">
              <h2 className="resume-heading">{heading}</h2>
              <div className="mt-2 space-y-4">
                {entries.map((entry) => (
                  <div key={entry.slug} className="resume-block">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-6">
                      <p className="text-sm font-semibold text-foreground">
                        {entry.title} <span className="text-muted-foreground">|</span>{" "}
                        <span className="font-normal text-muted-foreground italic">
                          {entry.org}
                        </span>
                      </p>
                      <p className="tabular font-mono text-xs text-muted-foreground">
                        {entry.dates}
                      </p>
                    </div>
                    <ul className="mt-1.5 space-y-1">
                      {entry.bullets.map((b) => (
                        <li
                          key={b}
                          className="relative pl-3.5 text-xs leading-relaxed text-muted-foreground before:absolute before:left-0 before:text-primary/70 before:content-['•']"
                        >
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ),
        )}
      </article>

      <p className="mt-6 text-xs text-muted-foreground print:hidden">
        Generated from the vault — every bullet above is the same text that feeds the project and
        experience pages.
      </p>
    </main>
  );
}
