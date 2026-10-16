import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { facetsQuery, peopleQuery, searchMoviesQuery, type Movie, type MovieFilters } from "@/lib/movies";
import { MovieCard } from "./MovieCard";
import { MovieDrawer } from "./MovieDrawer";

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const CATEGORIES: { label: string; filters: MovieFilters }[] = [
  { label: "Free to play now", filters: { sort: "popularity" } },
  { label: "Date night", filters: { genre: "Romance", sort: "rating" } },
  { label: "Game day", filters: { genre: "Sports", sort: "rating" } },
  { label: "Family movie night", filters: { genre: "Family", sort: "popularity" } },
  { label: "Mind-benders", filters: { genre: "Science Fiction", sort: "rating" } },
  { label: "Under 2 hours", filters: { maxRuntime: 120, sort: "rating" } },
];

function Chip({ active, children, onClick }: { active?: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs transition ${
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary/60 hover:border-primary"
      }`}
    >
      {children}
    </button>
  );
}

function PersonFilter({ role, value, onChange }: { role: "actor" | "director"; value?: string | undefined; onChange: (v?: string) => void }) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const people = useQuery(peopleQuery(dq, role));
  if (value)
    return (
      <Chip active onClick={() => onChange(undefined)}>
        {role === "actor" ? "Actor" : "Director"}: {value} <X className="ml-1 inline size-3" />
      </Chip>
    );
  return (
    <div className="relative">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={role === "actor" ? "Actor…" : "Director…"}
        className="h-7 w-32 rounded-full bg-secondary/60 text-xs"
      />
      {!!people.data?.length && q && (
        <div className="absolute left-0 top-8 z-20 w-56 rounded-xl border bg-popover p-1 shadow-soft">
          {people.data.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onChange(p.name);
                setQ("");
              }}
              className="block w-full rounded-lg px-2 py-1 text-left text-sm hover:bg-secondary"
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, filters, onOpen }: { label: string; filters: MovieFilters; onOpen: (m: Movie) => void }) {
  const { data } = useQuery(searchMoviesQuery(filters));
  const items = label === "Free to play now" ? data?.items.filter((m) => m.playableUrl) : data?.items;
  if (!items?.length) return null;
  return (
    <section>
      <h3 className="mb-3 text-lg">{label}</h3>
      <div className="-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-2">
        {items.slice(0, 12).map((m) => (
          <div key={m.id} className="w-32 shrink-0 snap-start sm:w-36">
            <MovieCard movie={m} onOpen={onOpen} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function MovieBrowser({ actions }: { actions?: ((m: Movie) => ReactNode) | undefined }) {
  const [text, setText] = useState("");
  const [f, setF] = useState<MovieFilters>({});
  const [open, setOpen] = useState<Movie | null>(null);
  const [focused, setFocused] = useState(false);
  const q = useDebounced(text);
  const facets = useQuery(facetsQuery);
  const filters: MovieFilters = { ...f, q };
  const filtering = Object.values(filters).some((v) => v !== undefined && v !== "");
  const results = useQuery({ ...searchMoviesQuery(filters), enabled: filtering });
  const suggestions = useQuery({ ...searchMoviesQuery({ q }), enabled: focused && q.length > 1 });
  const set = (patch: Partial<MovieFilters>) => setF((cur) => ({ ...cur, ...patch, page: 1 }));

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder='Search titles, actors or directors — typos welcome ("chrstopher nolan")'
          className="h-12 rounded-full bg-secondary/60 pl-11 text-base"
        />
        {focused && !!suggestions.data?.items.length && (
          <div className="absolute inset-x-0 top-14 z-30 rounded-2xl border bg-popover p-2 shadow-soft">
            {suggestions.data.items.slice(0, 6).map((m) => (
              <button
                key={m.id}
                onMouseDown={() => setOpen(m)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-secondary"
              >
                <span>
                  {m.title} <span className="text-muted-foreground">({m.year})</span>
                </span>
                <span className="text-xs text-muted-foreground">{m.directors[0]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-muted-foreground">Pick a genre</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-8">
          {[
            ["Comedy", "😂"], ["Horror", "👻"], ["Romance", "❤️"], ["Action", "💥"],
            ["Drama", "🎭"], ["Science Fiction", "🚀"], ["Animation", "🎨"], ["Family", "👨‍👩‍👧"],
            ["Thriller", "🔪"], ["Adventure", "🗺️"], ["Sports", "🏆"], ["Fantasy", "🧙"],
            ["Crime", "🕵️"], ["Music", "🎵"], ["War", "🎖️"], ["History", "📜"],
          ].map(([name, icon]) => {
            const count = facets.data?.genres.find((g) => g.name === name)?.count ?? 0;
            const active = f.genre === name;
            return (
              <button
                key={name}
                onClick={() => set({ genre: active ? undefined : name })}
                className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-xs transition ${
                  active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary/60 hover:border-primary"
                }`}
              >
                <span className="text-2xl">{icon}</span>
                <span className="font-medium">{name === "Science Fiction" ? "Sci‑Fi" : name}</span>
                <span className="opacity-60">{count} movies</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {facets.data?.languages.map((l) => (
          <Chip key={l.code} active={f.language === l.code} onClick={() => set({ language: f.language === l.code ? undefined : l.code })}>
            {l.name}
          </Chip>
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        <Chip active={f.yearTo === 1999} onClick={() => set(f.yearTo === 1999 ? { yearTo: undefined, yearFrom: undefined } : { yearFrom: undefined, yearTo: 1999 })}>
          Before 2000
        </Chip>
        <Chip active={f.yearFrom === 2010} onClick={() => set(f.yearFrom === 2010 ? { yearFrom: undefined, yearTo: undefined } : { yearFrom: 2010, yearTo: undefined })}>
          2010+
        </Chip>
        <Chip active={f.minRating === 8} onClick={() => set({ minRating: f.minRating === 8 ? undefined : 8 })}>
          Rated 8+
        </Chip>
        <Chip active={f.maxRuntime === 100} onClick={() => set({ maxRuntime: f.maxRuntime === 100 ? undefined : 100 })}>
          Under 100 min
        </Chip>
        <PersonFilter role="actor" value={f.actor} onChange={(v) => set({ actor: v })} />
        <PersonFilter role="director" value={f.director} onChange={(v) => set({ director: v })} />
        <select
          value={f.sort ?? ""}
          onChange={(e) => set({ sort: (e.target.value || undefined) as MovieFilters["sort"] })}
          className="h-7 rounded-full border bg-secondary/60 px-3 text-xs"
        >
          <option value="">Sort: best match</option>
          <option value="popularity">Popular</option>
          <option value="rating">Top rated</option>
          <option value="year">Newest</option>
          <option value="title">A–Z</option>
        </select>
        {filtering && (
          <button
            onClick={() => {
              setF({});
              setText("");
            }}
            className="text-xs text-muted-foreground underline"
          >
            Clear all
          </button>
        )}
      </div>

      {filtering ? (
        <div>
          <p className="mb-3 text-sm text-muted-foreground">{results.data?.total ?? "…"} movies</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {results.data?.items.map((m) => <MovieCard key={m.id} movie={m} onOpen={setOpen} />)}
          </div>
          {results.data && results.data.total === 0 && <p className="py-10 text-center text-muted-foreground">No matches. Try fewer filters.</p>}
        </div>
      ) : (
        <div className="space-y-8">
          {CATEGORIES.map((c) => (
            <Row key={c.label} label={c.label} filters={c.filters} onOpen={setOpen} />
          ))}
        </div>
      )}

      <MovieDrawer movie={open} onClose={() => setOpen(null)} onOpen={setOpen} actions={actions} />
      <p className="pt-4 text-center text-[11px] text-muted-foreground">
        Movie metadata: curated sample set. When seeded from TMDB, this product uses the TMDB API but is not endorsed or certified by TMDB.
      </p>
    </div>
  );
}
