import { useQuery } from "@tanstack/react-query";
import { Play, Wand2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { facetsQuery, type Movie } from "@/lib/movies";
import { rpc } from "@/lib/rpc";
import { suggestMovies } from "@/lib/suggest.functions";
import type { MemberView } from "@/lib/useRoom";

export const MOODS = ["Feel-good", "Thrilling", "Romantic", "Funny", "Mind-bending", "Cozy", "Epic", "Scary"];
export type GroupSuggestion = { movie: Movie; reason: string };

export function GroupPick({
  members, myPicks, onPicks, suggestions, onSuggestions, canControl, onPlay,
}: {
  members: MemberView[];
  myPicks: { genres: string[]; moods: string[] };
  onPicks: (p: { genres: string[]; moods: string[] }) => void;
  suggestions: GroupSuggestion[];
  onSuggestions: (s: GroupSuggestion[]) => void;
  canControl: boolean;
  onPlay: (m: Movie) => void;
}) {
  const facets = useQuery(facetsQuery);
  const [busy, setBusy] = useState(false);
  const genres = (facets.data?.genres ?? []).slice(0, 12).map((g) => g.name);

  const tally = (key: "genres" | "moods") => {
    const c = new Map<string, number>();
    for (const m of members) if (m.online) for (const v of m.picks?.[key] ?? []) c.set(v, (c.get(v) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  };
  const gT = tally("genres");
  const mT = tally("moods");

  const toggle = (key: "genres" | "moods", v: string) => {
    const cur = myPicks[key];
    onPicks({ ...myPicks, [key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] });
  };

  const suggest = async () => {
    setBusy(true);
    try {
      const topGenres = gT.slice(0, 3).map(([g]) => g);
      const lists = await Promise.all(
        (topGenres.length ? topGenres : [null]).map((g) =>
          rpc<{ items: Movie[] }>("search_movies", { q: null, p_genre: g, p_actor: null, p_director: null, p_language: null, p_year_from: null, p_year_to: null, p_min_rating: null, p_max_runtime: null, p_sort: "rating", p_page: 1, p_page_size: 20 }),
        ),
      );
      const byId = new Map<number, Movie>();
      for (const l of lists) for (const m of l.items) byId.set(m.id, m);
      const candidates = [...byId.values()].slice(0, 60);
      const res = await suggestMovies({
        data: {
          genres: gT.map(([g, n]) => `${g} (${n})`),
          moods: mT.map(([g, n]) => `${g} (${n})`),
          candidates: candidates.map((m) => ({ id: m.id, title: m.title, year: m.year, genres: m.genres, overview: m.overview?.slice(0, 400) ?? null })),
        },
      });
      if (res.error) toast.error(res.error);
      onSuggestions(res.picks.flatMap((p) => { const movie = byId.get(p.id); return movie ? [{ movie, reason: p.reason }] : []; }));
    } catch (e) {
      toast.error("Couldn't get suggestions", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const Chip = ({ v, k, n }: { v: string; k: "genres" | "moods"; n?: number | undefined }) => {
    const on = myPicks[k].includes(v);
    return (
      <button onClick={() => toggle(k, v)} className={`rounded-full border px-2.5 py-1 text-xs transition ${on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-secondary"}`}>
        {v}{n ? ` · ${n}` : ""}
      </button>
    );
  };

  return (
    <div className="space-y-3 rounded-2xl bg-card/90 p-4">
      <h2 className="flex items-center gap-2 font-display text-lg"><Wand2 className="size-5 text-primary" /> Group Pick</h2>
      <div>
        <div className="mb-1 text-xs text-muted-foreground">Genres you're into</div>
        <div className="flex flex-wrap gap-1.5">{genres.map((g) => <Chip key={g} v={g} k="genres" n={gT.find(([x]) => x === g)?.[1]} />)}</div>
      </div>
      <div>
        <div className="mb-1 text-xs text-muted-foreground">Your mood</div>
        <div className="flex flex-wrap gap-1.5">{MOODS.map((m) => <Chip key={m} v={m} k="moods" n={mT.find(([x]) => x === m)?.[1]} />)}</div>
      </div>
      <Button className="w-full" onClick={suggest} disabled={busy}>{busy ? "Thinking…" : "Suggest for the group"}</Button>
      <ul className="space-y-2">
        {suggestions.map(({ movie, reason }) => (
          <li key={movie.id} className="rounded-xl bg-secondary/60 p-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="flex-1 font-medium">{movie.title} {movie.year && <span className="text-muted-foreground">({movie.year})</span>}</span>
              {canControl && movie.playableUrl && <Button size="sm" variant="ghost" onClick={() => onPlay(movie)}><Play /></Button>}
            </div>
            <p className="text-xs text-muted-foreground">{reason}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
