import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Prose } from "@/components/site/prose";
import { Badge } from "@/components/ui/badge";
import { publicLabs } from "@/lib/vault/public";

export function generateStaticParams() {
  return publicLabs().map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: PageProps<"/labs/[slug]">) {
  const { slug } = await params;
  const lab = publicLabs().find((l) => l.slug === slug);
  if (!lab) return {};
  return { title: lab.title, description: lab.summary };
}

export default async function LabPage({ params }: PageProps<"/labs/[slug]">) {
  const { slug } = await params;
  const lab = publicLabs().find((l) => l.slug === slug);
  if (!lab) notFound();

  const meta = [
    { label: "Course", value: lab.course },
    { label: "Term", value: lab.term },
    { label: "Date", value: lab.date },
    { label: "Figures", value: String(lab.imageCount) },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <Link
        href="/labs"
        className="font-mono text-xs text-muted-foreground transition-colors hover:text-primary"
      >
        &larr; Labs
      </Link>

      <h1 className="mt-6 text-3xl font-extrabold tracking-tight sm:text-4xl">{lab.title}</h1>
      <p className="mt-3 max-w-[60ch] text-muted-foreground">{lab.summary}</p>

      <dl className="mt-8 grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
        {meta.map((m) => (
          <div key={m.label} className="bg-background p-3">
            <dt className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground">
              {m.label}
            </dt>
            <dd className="tabular mt-1 text-sm text-foreground">{m.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 flex flex-wrap gap-1.5">
        {lab.stack.map((s) => (
          <Badge key={s} variant="secondary" className="text-[0.7rem]">
            {s}
          </Badge>
        ))}
        {lab.tags.map((t) => (
          <Badge key={t} variant="outline" className="text-[0.7rem]">
            {t}
          </Badge>
        ))}
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        Group lab, co-authored with{" "}
        <span className="text-foreground">{lab.collaborators.join(", ")}</span>.
      </p>

      {lab.bullets.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-bold tracking-tight">What I built</h2>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {lab.bullets.map((b) => (
              <li
                key={b}
                className="relative pl-4 before:absolute before:left-0 before:text-primary/60 before:content-['—']"
              >
                {b}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12">
        <Prose>{lab.body}</Prose>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-bold tracking-tight">Figures</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {lab.figures.map((file, i) => (
            <figure key={file} className="space-y-1.5">
              <div className="relative aspect-[4/3] overflow-hidden rounded border border-border bg-accent">
                <Image
                  src={`/labs/${file}`}
                  alt={`${lab.title}, figure ${i + 1}`}
                  fill
                  sizes="(max-width: 640px) 50vw, 240px"
                  className="object-contain p-1.5"
                  loading={i < 3 ? "eager" : "lazy"}
                />
              </div>
              <figcaption className="tabular font-mono text-[0.62rem] text-muted-foreground">
                Fig. {i + 1}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </main>
  );
}
