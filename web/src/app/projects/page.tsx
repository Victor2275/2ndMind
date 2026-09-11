import { ProjectGrid, parseSort } from "@/components/site/project-grid";
import { projectCards } from "@/lib/vault/public";

export const metadata = {
  title: "Projects",
  description: "Software, robotics, and simulation projects built by Victor Gusev.",
};

/**
 * Filter and sort live in the URL (Q324), so this page reads `searchParams`.
 *
 * That makes it dynamic rather than statically prerendered, which is the cost of the feature and
 * is worth naming: a filtered view could not be linked, bookmarked, or crawled before, and that
 * is the whole of Q324's complaint. Nothing here touches a database — the vault is read from the
 * filesystem at request time and the response is cheap.
 */
export default async function ProjectsPage({ searchParams }: PageProps<"/projects">) {
  const params = await searchParams;
  const projects = projectCards();

  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
      <h1 className="font-heading text-4xl font-extrabold tracking-tight">Projects</h1>

      <div className="mt-10">
        <ProjectGrid
          projects={projects}
          category={first(params.category) ?? "all"}
          sort={parseSort(first(params.sort))}
        />
      </div>
    </main>
  );
}
