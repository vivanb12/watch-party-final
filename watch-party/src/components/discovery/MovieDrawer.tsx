import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatRuntime, similarQuery, type Movie } from "@/lib/movies";
import { Poster } from "./MovieCard";

export function MovieDrawer({
  movie,
  onClose,
  onOpen,
  actions,
}: {
  movie: Movie | null;
  onClose: () => void;
  onOpen: (m: Movie) => void;
  actions?: ((m: Movie) => ReactNode) | undefined;
}) {
  const similar = useQuery({ ...similarQuery(movie?.id ?? 0), enabled: !!movie });
  return (
    <Sheet open={!!movie} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto border-border bg-card sm:max-w-md">
        {movie && (
          <>
            <SheetHeader>
              <SheetTitle className="font-display text-2xl">{movie.title}</SheetTitle>
              <SheetDescription>
                {[movie.year, formatRuntime(movie.runtime), movie.language?.toUpperCase()].filter(Boolean).join(" · ")}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 grid grid-cols-[120px_1fr] gap-4 px-4">
              <Poster movie={movie} />
              <div className="space-y-2 text-sm">
                {movie.rating != null && (
                  <div className="inline-flex items-center gap-1 text-primary">
                    <Star className="size-4 fill-current" /> {movie.rating} / 10
                  </div>
                )}
                <div className="flex flex-wrap gap-1">
                  {movie.genres.map((g) => (
                    <span key={g} className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                      {g}
                    </span>
                  ))}
                </div>
                {movie.directors.length > 0 && (
                  <p className="text-muted-foreground">
                    Directed by <span className="text-foreground">{movie.directors.join(", ")}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-4 px-4 pb-6">
              <p className="text-sm leading-relaxed text-muted-foreground">{movie.overview}</p>
              {movie.cast.length > 0 && (
                <div>
                  <h4 className="mb-1 text-sm font-semibold">Top cast</h4>
                  <p className="text-sm text-muted-foreground">{movie.cast.map((c) => c.name).join(", ")}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2">{actions?.(movie)}</div>
              {!movie.playableUrl && (
                <p className="rounded-xl bg-secondary p-3 text-xs text-muted-foreground">
                  Discovery only — there's no free, legal stream for this film. Members can still watch it together with "Load your own file".
                </p>
              )}
              {!!similar.data?.length && (
                <div>
                  <h4 className="mb-2 text-sm font-semibold">More like this</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {similar.data.slice(0, 6).map((m) => (
                      <button key={m.id} onClick={() => onOpen(m)} className="text-left">
                        <Poster movie={m} className="text-xs" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
