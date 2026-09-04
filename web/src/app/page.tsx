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
      {/* Hero. No `rise` — this is the first thing on screen, and the fade delayed FCP by
          ~900ms on a warm load (measured 2026-09-04): opacity:0 frames don't count as painted,
          so the hero was invisible until its own animation finished. `.rise` still does real
          work further down, where it plays while the reader is elsewhere on the page. */}
      <section className="flex flex-col gap-8 sm:flex-row sm:items-start">
        <div className="group relative shrink-0">
          {/* Soft teal bloom behind the portrait, brightening on hover. */}
          <div
            aria-hidden
            className="absolute -inset-3 rounded-xl bg-primary/15 opacity-60 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
          />
          {/* The real photograph, synced from context/assets by scripts/sync-vault-assets.mjs.
              It is 2048x1365 (3:2) rendered into a square, so it needs object-cover — without
              it the portrait stretches. `object-top` because a 3:2 photograph cropped square
              from the centre tends to cut the top of the head. */}
          <Image
            src="/assets/ProfilePhoto.jpg"
            alt={`Portrait of ${profile.name}`}
            width={288}
            height={288}
            priority
            className="relative h-32 w-32 rounded-lg border border-border object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.03] sm:h-36 sm:w-36"
          />
        </div>

        <div className="min-w-0">
          <p className="font-mono text-xs tracking-[0.18em] text-highlight uppercase">
            {profile.persona}
          </p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
            {profile.name}
          </h1>
          <p className="mt-4 max-w-[60ch] text-muted-foreground">
            {profile.academicStage} at {profile.schoolShort}, on a three-year track. Building
            autonomous systems using reinforcement learning, LiDAR, and vision tools.
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
                  c.mono ? "font-mono" : "",
                  c.accent ? "text-primary" : "text-muted-foreground hover:text-foreground",
                ].join("")}
              >
                {c.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Facts. Still above the fold at most widths — same reasoning as the hero above. */}
      <dl className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {facts.map((f) => (
          <div
            key={f.label}
            className="rounded-lg border border-border bg-card/70 p-4 transition-colors duration-300 hover:border-primary/50"
          >
            <dt className="font-mono text-[0.62rem] tracking-[0.16em] text-muted-foreground uppercase">
              {f.label}
            </dt>
            <dd className="tabular mt-1.5 text-sm font-medium text-foreground">{f.value}</dd>
          </div>
        ))}
      </dl>

      {/* The most recent role, given a spotlight. Deliberately *not* headed "What I'm working
          on now": this renders `experience[0]`, which is whatever sorts first, and saying "now"
          made a claim about employment that the vault's own `date_end` contradicted. The
          "what I'm working on now" section Victor asked for is about current *work* — 2ndMind,
          coursework — and is still to be built. */}
      {experience.length > 0 && (
        <section className="mt-16 rise" style={{ animationDelay: "200ms" }}>
          <h2 className="text-xl font-bold tracking-tight">Most recent</h2>
          <div className="mt-6">
            <article className="group relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-b from-primary/5 to-transparent p-6 shadow-sm transition-all duration-500 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_8px_30px_-12px_var(--primary)]">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--primary)_0%,_transparent_70%)] opacity-0 mix-blend-screen transition-opacity duration-500 group-hover:opacity-15" />
              <div className="relative z-10 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="text-lg font-bold text-foreground">
                  {experience[0].title} <span className="text-primary">@ {experience[0].org}</span>
                </h3>
                <p className="tabular font-mono text-xs font-medium text-primary">
                  {/* "Present" only when the vault says the role is ongoing. It was hard-coded
                      once, outlived the fact behind it, and told every hiring manager that a
                      finished internship was still running — so it is data now, not markup. */}
                  {experience[0].dateStart} —{" "}
                  {experience[0].ongoing ? "Present" : experience[0].dateEnd}
                </p>
              </div>
              <ul className="relative z-10 mt-4 space-y-2 text-sm text-muted-foreground">
                {experience[0].bullets.map((b) => (
                  <li
                    key={b}
                    className="relative pl-5 before:absolute before:top-1.5 before:left-0 before:h-1.5 before:w-1.5 before:rounded-full before:bg-primary/60"
                  >
                    {b}
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </section>
      )}

      {/* Previous Experience */}
      {experience.length > 1 && (
        <section className="mt-16 rise" style={{ animationDelay: "240ms" }}>
          <h2 className="text-xl font-bold tracking-tight">Previous Experience</h2>
          <div className="mt-6 space-y-8">
            {experience.slice(1).map((role) => (
              <article
                key={role.slug}
                className="group relative border-l-2 border-border pl-5 transition-colors duration-300 hover:border-primary/70"
              >
                <span
                  aria-hidden
                  className="absolute top-2 -left-[5px] size-2 rounded-full bg-border transition-all duration-300 group-hover:scale-125 group-hover:bg-primary/70"
                />
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 className="text-base font-semibold text-foreground">
                    {role.title} <span className="text-muted-foreground">·</span>{" "}
                    <span className="transition-colors group-hover:text-primary/80">
                      {role.org}
                    </span>
                  </h3>
                  <p className="tabular font-mono text-xs text-muted-foreground">
                    {role.dateStart} — {role.ongoing ? "Present" : role.dateEnd}
                  </p>
                </div>
                <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  {role.bullets.map((b) => (
                    <li
                      key={b}
                      className="relative pl-4 before:absolute before:left-0 before:text-primary/40 before:content-['—']"
                    >
                      {b}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Pointers */}
      <section className="mt-16 grid gap-4 sm:grid-cols-2">
        <Link
          href="/projects"
          className="group card-scan rise rounded-lg border border-border bg-card/70 p-6"
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
          className="group card-scan rise rounded-lg border border-border bg-card/70 p-6"
          style={{ animationDelay: "320ms" }}
        >
          <p className="font-mono text-[0.62rem] tracking-[0.16em] text-highlight uppercase">
            Most recent build
          </p>
          <h2 className="mt-2 text-base font-semibold transition-colors group-hover:text-primary">
            {featured.title}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{featured.summary}</p>
        </Link>
      </section>

      {/* Breadth. Framed by what each pursuit carries back into engineering, so it reads
          as range rather than as a list of hobbies. */}
      <section className="mt-16">
        <h2 className="text-xl font-bold tracking-tight">Hobbies and Interests</h2>

        <div className="mt-6 grid gap-3 lg:grid-cols-3">
          {pursuits.map((p, i) => (
            <article
              key={p.slug}
              style={{ animationDelay: `${240 + i * 70}ms` }}
              className="group card-scan flex rise flex-col rounded-lg border border-border bg-card/70 p-4"
            >
              <p className="font-mono text-[0.62rem] tracking-[0.16em] text-highlight uppercase">
                {p.kicker}
              </p>
              <h3 className="mt-1.5 text-base font-semibold tracking-tight transition-colors group-hover:text-primary">
                {p.title}
              </h3>

              <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                {p.bullets.map((b) => (
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
    </main>
  );
}
