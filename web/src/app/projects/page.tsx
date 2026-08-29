import { ProjectGrid } from "@/components/site/project-grid";
import { projectCards } from "@/lib/vault/public";

export const metadata = {
  title: "Projects",
  description: "Software, robotics, and simulation projects built by Victor Gusev.",
};

export default function ProjectsPage() {
  const projects = projectCards();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
      <h1 className="text-4xl font-extrabold tracking-tight">Projects</h1>

      <div className="mt-10">
        <ProjectGrid projects={projects} />
      </div>
    </main>
  );
}
