import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { ABOUT_PARAGRAPH, POSITIONING } from "@/lib/profile-copy";
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
  // The one project a stranger should see first (Q309). Explicit frontmatter, not `projects[0]`
  // — that comment used to say "sorted tier then year", which stopped being true when D-107
  // removed tiers, and it resolved to `order: 1`: a finished recipe PWA leading a page whose
  // eyebrow reads "Robotics Engineer". `featured.test.ts` guarantees exactly one.
  const featured = projects.find((p) => p.featured) ?? projects[0];

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
      <section className="flex flex-col gap-8 py-6 sm:flex-row sm:items-start sm:gap-10 sm:py-10">
        {/* `w-fit self-start`: in the phone layout this column is a flex *item in a column*, so
            it stretches to the full width by default and the frame below — which is positioned
            against it — stretched with it, drawing a rounded rectangle across the whole page
            beside the portrait. `shrink-0` alone only governs the row layout. */}
        <div className="group relative w-fit shrink-0 self-start">
          {/* The bloom is gone (Q218). It was `bg-primary/15` blurred behind the portrait, and it
              read as a photo-editing glow rather than as a design element — the one piece of the
              page that looked applied rather than drawn. What replaces it is structural: an inset
              ring and a hairline offset frame, the same language Q221 chose for project images.
              Nothing here animates on hover any more except the frame's colour. */}
          <div
            aria-hidden
            className="absolute -inset-2 rounded-xl border border-border/60 transition-colors duration-medium ease-standard group-hover:border-primary/40"
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
            className="relative h-40 w-40 rounded-lg object-cover object-top ring-1 ring-border transition-[--tw-ring-color] duration-medium ease-standard ring-inset group-hover:ring-primary/40 sm:h-48 sm:w-48"
          />
        </div>

        <div className="min-w-0">
          <p className="eyebrow text-primary">{profile.persona}</p>
          <h1 className="mt-3 font-heading text-4xl font-extrabold tracking-tight sm:text-5xl">
            {profile.name}
          </h1>

          {/* The positioning line (Q307): below the name, and larger than the sentence it
              replaced, which was a fact about enrolment dressed as a claim. It is set from
              `lib/profile-copy.ts` because the OG card says it too, and a headline that differs
              between the page and its own link preview is worse than either. */}
          <p className="mt-4 max-w-[34ch] text-xl leading-snug text-foreground sm:text-2xl">
            {POSITIONING}
          </p>

          {/* Two calls to action (Q309). The resume stays primary — it is what a recruiter came
              for — and the featured project is the second, because the fastest way to believe a
              positioning line is to open the thing it describes. */}
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/resume/robotics"
              className="inline-flex items-center gap-2 rounded-control border border-primary/50 px-4 py-2 text-sm text-primary transition-colors duration-fast ease-standard hover:border-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              View resume
              <span aria-hidden>&rarr;</span>
            </Link>
            <Link
              href={`/projects/${featured.slug}`}
              className="inline-flex items-center gap-2 rounded-control px-4 py-2 text-sm text-muted-foreground transition-colors duration-fast ease-standard hover:bg-accent/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {featured.title}
              <span aria-hidden>&rarr;</span>
            </Link>
          </div>

          {/* Q346 — `/now` is reachable from the hero, not only from the nav. Deliberately a
              text link rather than a third button: two calls to action are a choice and three
              are a menu, and this one is for a reader who has already decided to look around. */}
          <p className="mt-4 text-sm text-muted-foreground">
            Or see{" "}
            <Link
              href="/now"
              className="link-wipe text-foreground transition-colors hover:text-primary"
            >
              what I am working on now
            </Link>
            .
          </p>

          {/* Reduced, per Q310 — the full set is in the footer. Email and the two profiles a
              recruiter actually clicks; the phone number stays public (Q311) but comes off the
              hero, where four links competed with the two buttons above them. */}
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
            {contacts
              .filter((c) => !c.mono)
              .map((c) => (
                <a
                  key={c.label}
                  href={c.href}
                  className={[
                    "link-wipe text-sm transition-colors duration-fast",
                    c.accent ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  {c.label}
                </a>
              ))}
          </div>
        </div>
      </section>

      {/* One paragraph of prose (Q321). Below the hero rather than inside it: the hero is the
          claim and this is the evidence, and a reader who wants only the claim should not have
          to read past it. */}
      <p className="mt-10 max-w-[62ch] text-base leading-relaxed text-muted-foreground">
        {ABOUT_PARAGRAPH}
      </p>

      {/* Facts (Q313): a single dense line at phone width, cards from `phone` up.
          Four bordered cards stacked two-by-two on a 360px screen cost ~180px to say four short
          things, and pushed the first role below the fold. As a line they cost one. */}
      <dl className="mt-10 flex flex-col gap-y-2 phone:grid phone:grid-cols-4 phone:gap-3">
        {facts.map((f) => (
          <div
            key={f.label}
            className="flex items-baseline justify-between gap-3 border-b border-border/50 pb-2 last:border-b-0 phone:block phone:rounded-card phone:border phone:border-border phone:bg-card/70 phone:p-4 phone:pb-4 phone:transition-colors phone:duration-fast phone:hover:border-primary/50"
          >
            <dt className="eyebrow text-muted-foreground">{f.label}</dt>
            <dd className="tabular text-sm font-medium text-foreground phone:mt-1.5">{f.value}</dd>
          </div>
        ))}
      </dl>

      {/* The most recent role, given a spotlight. Deliberately *not* headed "What I'm working
          on now": this renders `experience[0]`, which is whatever sorts first, and saying "now"
          made a claim about employment that the vault's own `date_end` contradicted. The
          "what I'm working on now" section Victor asked for is about current *work* — 2ndMind,
          coursework — and is still to be built. */}
      {experience.length > 0 && (
        <section className="mt-16 rise">
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
        <section className="mt-16 rise">
          <h2 className="text-xl font-bold tracking-tight">Previous Experience</h2>
          <div className="mt-6 space-y-8">
            {experience.slice(1).map((role) => (
              /* Q317 — a fixed date gutter from `laptop` up. The dates used to sit at the end of
                 the title row and wrapped under it whenever a role name was long, so the column
                 of dates a reader scans for was not a column at all. In the gutter they line up
                 and the titles start at one x-position. Below `laptop` there is no room for a
                 gutter and they stay above the title, where they read as a caption. */
              <article
                key={role.slug}
                className="group relative border-l-2 border-border pl-5 transition-colors duration-fast hover:border-primary/70 laptop:grid laptop:grid-cols-[10rem_1fr] laptop:gap-x-6 laptop:border-l-0 laptop:pl-0"
              >
                <span
                  aria-hidden
                  className="absolute top-2 -left-[5px] size-2 rounded-full bg-border transition-all duration-fast group-hover:scale-125 group-hover:bg-primary/70 laptop:hidden"
                />
                <p className="tabular order-first font-mono text-xs text-muted-foreground laptop:pt-1 laptop:text-right">
                  {role.dateStart} — {role.ongoing ? "Present" : role.dateEnd}
                </p>
                <div className="laptop:border-l-2 laptop:border-border laptop:pl-6 laptop:transition-colors laptop:duration-fast laptop:group-hover:border-primary/70">
                  <h3 className="mt-1 text-base font-semibold text-foreground laptop:mt-0">
                    {role.title} <span className="text-muted-foreground">·</span>{" "}
                    <span className="transition-colors group-hover:text-primary/80">
                      {role.org}
                    </span>
                  </h3>
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
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Pointers */}
      <section className="mt-16 grid rise-stagger gap-4 sm:grid-cols-2">
        <Link
          href="/projects"
          className="group card-scan rounded-lg border border-border bg-card/70 p-6"
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
          className="group card-scan rounded-lg border border-border bg-card/70 p-6"
        >
          {/* Was "Most recent build", which was never checked against anything: it rendered
              `projects[0]`, i.e. `order: 1`, which is a 2025 project marked `done`. The card now
              renders whatever carries `featured: true` and says so honestly. */}
          <p className="eyebrow text-primary">Featured</p>
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

        <div className="mt-6 grid rise-stagger gap-3 lg:grid-cols-3">
          {pursuits.map((p) => (
            <article
              key={p.slug}
              className="group card-scan flex flex-col rounded-lg border border-border bg-card/70 p-4"
            >
              <p className="eyebrow text-primary">{p.kicker}</p>
              <h3 className="mt-1.5 text-base font-semibold tracking-tight transition-colors group-hover:text-primary">
                {p.title}
              </h3>

              {/* Q319 — three cards, shorter. Two bullets each: the section is breadth, and a
                  reader who wants the third line about dragon boat is not on this page. The
                  entries themselves are untouched, so nothing is lost from the vault. */}
              <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                {p.bullets.slice(0, 2).map((b) => (
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
