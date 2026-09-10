import { ExerciseDetail } from "@/components/site/exercise-detail";
import { PageHeader } from "@/components/site/page-shell";

/**
 * One exercise, in full (V4 Phase 2++ Stage 4).
 *
 * `slug` is `seedKey ?? name`, URL-encoded — see `exercise-list.tsx`'s `exerciseHref`. Not
 * `clientId`, deliberately: a bundle-only entry (not yet synced to this device) has no client id
 * at all, and this route has to resolve before the first pull completes, same as every other
 * athletics screen (D-224).
 */
export const metadata = {
  title: "Exercise",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ExerciseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <main className="max-w-3xl pb-16">
      <PageHeader eyebrow="Athletics" title="Exercise" />
      <div className="mt-6">
        <ExerciseDetail slug={slug} />
      </div>
    </main>
  );
}
