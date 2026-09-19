import { SkeletonHeader, SkeletonPanel, SkeletonStats } from "@/components/site/skeleton";

/**
 * Shown the instant a navigation starts, while the server renders.
 *
 * This also enables prefetching: the App Router can fetch a dynamic route's loading boundary
 * ahead of the click, so the transition begins immediately rather than after a round trip.
 * The layout — nav, sign-out — stays mounted and does not flash.
 */
export default function PrivateLoading() {
  return (
    <div className="pb-16">
      <SkeletonHeader />
      <SkeletonStats />
      <div className="mt-8 space-y-4">
        <SkeletonPanel rows={4} />
        <SkeletonPanel rows={2} />
      </div>
    </div>
  );
}
