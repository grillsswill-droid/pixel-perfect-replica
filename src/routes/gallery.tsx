import { queryOptions, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { z } from "zod";

import { GalleryExperience } from "@/components/gallery/gallery-experience";
import { Button } from "@/components/ui/button";
import { getPublicGalleryItems } from "@/lib/admin.functions";
import { createPublicPageHead, seoFromMatches } from "@/lib/seo";

const galleryQuery = () =>
  queryOptions({
    queryKey: ["gallery"],
    queryFn: () => getPublicGalleryItems(),
    staleTime: 60_000,
  });

export const Route = createFileRoute("/gallery")({
  validateSearch: z.object({ post: z.string().uuid().optional().catch(undefined) }),
  loader: ({ context }) => context.queryClient.ensureQueryData(galleryQuery()),
  head: ({ matches }) => createPublicPageHead("/gallery", seoFromMatches(matches)),
  component: GalleryPage,
});

function GalleryPage() {
  const { data = [], isLoading, isError, isFetching, refetch } = useQuery(galleryQuery());
  const { post } = Route.useSearch();
  return (
    <div className="min-h-[65vh] bg-background">
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-7 sm:px-8 sm:pt-10">
        <div
          className="mb-7 flex flex-wrap items-center justify-between gap-5"
          data-reveal="heading"
        >
          <div className="flex min-w-0 items-center gap-4">
            <img
              src="/favicon.png"
              alt=""
              width="64"
              height="64"
              className="h-14 w-14 shrink-0 sm:h-16 sm:w-16"
            />
            <div className="min-w-0">
              <h1 className="font-display text-3xl font-black uppercase sm:text-4xl">
                The gallery
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                A closer look at the food, packaging and moments coming fresh off the Grill & Swill
                line.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/menu">
              Browse the menu <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
        {isLoading ? (
          <p role="status" className="py-8 text-sm text-muted-foreground">
            Loading the gallery…
          </p>
        ) : null}
        {isError ? (
          <div role="alert" className="rounded-2xl bg-destructive/10 p-5 text-sm text-destructive">
            <p>The gallery couldn’t be loaded.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              loading={isFetching}
              onClick={() => void refetch()}
            >
              Try again
            </Button>
          </div>
        ) : null}
        {!isLoading && !isError ? (
          <GalleryExperience key={post || "gallery"} items={data} initialPostId={post} />
        ) : null}
      </div>
    </div>
  );
}
