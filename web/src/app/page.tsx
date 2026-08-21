import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  publicExperience,
  publicProfile,
  publicProjects,
  publicPursuits,
} from "@/lib/vault/public";

export const metadata = {
  title: "About",
  description:
    "Victor Gusev — robotics, computer vision, and embedded systems. B.S. Computer Science and Engineering at UCLA.",
};

/** Turns 2028-06 into "June 2028"; leaves a bare year alone. */
function formatMonth(value: string) {
  const [year, month] = value.split("-");
  if (!month) return year;
  const name = new Date(Date.UTC(Number(year), Number(month) - 1, 1)).toLocaleString("en-US", {
    month: "long",
    timeZone: "UTC",
  });
  return `${name} ${year}`;
}

export default function AboutPage() {
  const profile = publicProfile();
  const experience = publicExperience().filter((e) => e.bullets.length > 0);
  const projects = publicProjects();
  const pursuits = publicPursuits();
  // Projects are sorted tier then year, so the first entry is the strongest recent build.
  const featured = projects[0];

  const facts = [
    { label: "Degree", value: profile.degree },
    { label: "School", value: profile.school },
    { label: "Graduating", value: formatMonth(profile.graduation) },
    { label: "GPA", value: `${profile.gpa.toFixed(2)} / ${profile.gpaScale.toFixed(2)}` },
  ];

  const contacts = [
    { href: `mailto:${profile.contact.email}`, label: profile.contact.email, accent: true },
    {
      href: `tel:${profile.contact.phone.replace(/[^\d+]/g, "")}`,
      label: profile.contact.phone,
      mono: true,
    },
    { href: profile.contact.github, label: "GitHub" },
    { href: profile.contact.linkedin, label: "LinkedIn" },
  ];

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
      {/* Hero */}
      <section className="rise flex flex-col gap-8 sm:flex-row sm:items-start">
        <div className="group relative shrink-0">
          {/* Soft teal bloom behind the portrait, brightening on hover. */}
          <div
            aria-hidden
            className="absolute -inset-3 rounded-xl bg-primary/15 opacity-60 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
          />
          <Image
            src="/avatar-placeholder.svg"
            alt={`Portrait of ${profile.name}`}
            width={144}
            height={144}
            priority
            className="relative h-32 w-32 rounded-lg border border-border transition-transform duration-500 ease-out group-hover:scale-[1.03] sm:h-36 sm:w-36"
          />
        </div>

        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-highlight">
            {profile.persona}
          </p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
            {profile.name}
          </h1>
          <p className="mt-4 max-w-[60ch] text-muted-foreground">
            {profile.academicStage} at {profile.schoolShort}, on a three-year track. I build
            autonomous systems: reinforcement-learning planners, vision and LiDAR pipelines,
            and the embedded instrumentation underneath them.
          </p>

          <div className="mt-6">
            <Link
              href="/resume/robotics"
              className="inline-flex items-center gap-2 rounded-md border border-primary/50 px-4 py-2 text-sm text-primary transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:bg-primary/10 hover:shadow-[0_0_20px_-6px_var(--primary)]"
            >
              View resume
              <span aria-hidden>&rarr;</span>
            </Link>
          </div>

          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
            {contacts.map((c) => (
              <a
                key={c.label}
                href={c.href}
                className={[
                  "link-wipe text-sm transition-colors",
                  c.mono ? "font-mono " : "",
                  c.accent
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                ].join("")}
              >
                {c.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Facts */}
      <dl
        className="rise mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4"
        style={{ animationDelay: "120ms" }}
      >
        {facts.map((f) => (
          <div
            key={f.label}
            className="rounded-lg border border-border bg-card/70 p-4 transition-colors duration-300 hover:border-primary/50"
          >
            <dt className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">
              {f.label}
            </dt>
            <dd className="tabular mt-1.5 text-sm font-medium text-foreground">{f.value}</dd>
          </div>
        ))}
      </dl>

      {/* Experience */}
      <section className="rise mt-16" style={{ animationDelay: "200ms" }}>
        <h2 className="text-xl font-bold tracking-tight">Experience</h2>
        <div className="mt-6 space-y-8">
          {experience.map((role) => (
            <article
              key={role.slug}
              className="group relative border-l-2 border-border pl-5 transition-colors duration-300 hover:border-primary"
            >
              {/* Node on the rail — marks the entry the pointer is on. */}
              <span
                aria-hidden
                className="absolute -left-[5px] top-2 size-2 rounded-full bg-border transition-all duration-300 group-hover:bg-primary group-hover:shadow-[0_0_10px_2px_var(--primary)]"
              />
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="text-base font-semibold text-foreground">
                  {role.title} <span className="text-muted-foreground">·</span>{" "}
                  <span className="transition-colors group-hover:text-primary">{role.org}</span>
                </h3>
                <p className="tabular font-mono text-xs text-muted-foreground">
                  {role.dateStart} — {role.dateEnd}
                </p>
              </div>
              <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                {role.bullets.map((b) => (
                  <li
                    key={b}
                    className="relative pl-4 before:absolute before:left-0 before:text-primary/60 before:content-['—']"
                  >
                    {b}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {/* Breadth. Framed by what each pursuit carries back into engineering, so it reads
          as range rather than as a list of hobbies. */}
      <section className="mt-16">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 className="text-xl font-bold tracking-tight">Outside the lab</h2>
          <p className="max-w-[42ch] text-sm text-muted-foreground">
            Three things I do seriously, and what each one taught me that shows up in the
            work above.
          </p>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {pursuits.map((p, i) => (
            <article
              key={p.slug}
              style={{ animationDelay: `${240 + i * 70}ms` }}
              className="rise card-scan group flex flex-col rounded-lg border border-border bg-card/70 p-5"
            >
              <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-highlight">
                {p.kicker}
              </p>
              <h3 className="mt-2 text-base font-semibold tracking-tight transition-colors group-hover:text-primary">
                {p.title}
              </h3>

              <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                {p.facts.map((f) => (
                  <div key={f.label}>
                    <dt className="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground">
                      {f.label}
                    </dt>
                    <dd className="tabular mt-0.5 font-mono text-sm text-foreground">
                      {f.value}
                    </dd>
                  </div>
                ))}
              </dl>

              <ul className="mt-4 flex-1 space-y-1.5 text-sm text-muted-foreground">
                {p.bullets.map((b) => (
                  <li
                    key={b}
                    className="relative pl-4 before:absolute before:left-0 before:text-primary/60 before:content-['—']"
                  >
                    {b}
                  </li>
                ))}
              </ul>

              <p className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground/90 italic">
                {p.carryover}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Pointers */}
      <section className="mt-16 grid gap-4 sm:grid-cols-2">
        <Link
          href="/projects"
          className="rise card-scan group rounded-lg border border-border bg-card/70 p-6"
          style={{ animationDelay: "260ms" }}
        >
          <h2 className="text-base font-semibold transition-colors group-hover:text-primary">
            Projects
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {projects.length} builds across software, robotics, and simulation.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[...new Set(projects.map((p) => p.category))].map((c) => (
              <Badge key={c} variant="outline" className="text-[0.65rem]">
                {c}
              </Badge>
            ))}
          </div>
        </Link>

        <Link
          href={`/projects/${featured.slug}`}
          className="rise card-scan group rounded-lg border border-border bg-card/70 p-6"
          style={{ animationDelay: "320ms" }}
        >
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-highlight">
            Most recent build
          </p>
          <h2 className="mt-2 text-base font-semibold transition-colors group-hover:text-primary">
            {featured.title}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{featured.summary}</p>
        </Link>
      </section>
    </main>
  );
}
