import { motion } from "framer-motion";
import { Play, Star } from "lucide-react";
import type { CSSProperties } from "react";
import { posterHue, type Movie } from "@/lib/movies";

export function Poster({ movie, className = "" }: { movie: Movie; className?: string }) {
  return (
    <div
      className={`poster relative flex aspect-[2/3] flex-col justify-end overflow-hidden rounded-2xl p-3 ${className}`}
      style={{ "--poster-hue": posterHue(movie.id) } as CSSProperties}
    >
      <div className="absolute -right-6 -top-6 size-24 rounded-full bg-foreground/10" />
      <div className="absolute right-6 top-10 size-10 rounded-full bg-foreground/10" />
      <span className="font-display text-lg leading-tight text-foreground drop-shadow">{movie.title}</span>
      <span className="text-xs text-foreground/70">{movie.year}</span>
    </div>
  );
}

export function MovieCard({ movie, onOpen }: { movie: Movie; onOpen: (m: Movie) => void }) {
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      onClick={() => onOpen(movie)}
      className="group w-full text-left focus:outline-none"
    >
      <div className="relative">
        <Poster movie={movie} className="shadow-soft transition group-hover:ring-2 group-hover:ring-primary" />
        <span
          className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            movie.playableUrl ? "bg-success text-primary-foreground" : "bg-background/70 text-muted-foreground"
          }`}
        >
          {movie.playableUrl ? (
            <>
              <Play className="size-3" /> Play
            </>
          ) : (
            "Discovery only"
          )}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">{movie.genres.slice(0, 2).join(" · ")}</span>
        {movie.rating != null && (
          <span className="inline-flex items-center gap-0.5 text-primary">
            <Star className="size-3 fill-current" /> {movie.rating}
          </span>
        )}
      </div>
    </motion.button>
  );
}
