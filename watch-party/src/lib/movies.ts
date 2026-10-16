import { queryOptions } from "@tanstack/react-query";
import { rpc } from "./rpc";

export type Movie = {
  id: number;
  title: string;
  originalTitle: string | null;
  year: number | null;
  overview: string | null;
  runtime: number | null;
  rating: number | null;
  popularity: number | null;
  language: string | null;
  posterPath: string | null;
  playableUrl: string | null;
  genres: string[];
  directors: string[];
  cast: { name: string; character: string | null }[];
  score?: number | undefined;
};

export type MovieFilters = {
  q?: string | undefined;
  genre?: string | undefined;
  actor?: string | undefined;
  director?: string | undefined;
  language?: string | undefined;
  yearFrom?: number | undefined;
  yearTo?: number | undefined;
  minRating?: number | undefined;
  maxRuntime?: number | undefined;
  sort?: "relevance" | "rating" | "year" | "popularity" | "title" | "runtime" | undefined;
  page?: number | undefined;
};

export type Facets = {
  genres: { name: string; count: number }[];
  languages: { code: string; name: string; count: number }[];
  total: number;
};

export type Person = { id: number; name: string; score: number; role: "actor" | "director" };

export const searchMoviesQuery = (f: MovieFilters) =>
  queryOptions({
    queryKey: ["movies", f],
    queryFn: () =>
      rpc<{ total: number; page: number; items: Movie[] }>("search_movies", {
        q: f.q || null,
        p_genre: f.genre ?? null,
        p_actor: f.actor ?? null,
        p_director: f.director ?? null,
        p_language: f.language ?? null,
        p_year_from: f.yearFrom ?? null,
        p_year_to: f.yearTo ?? null,
        p_min_rating: f.minRating ?? null,
        p_max_runtime: f.maxRuntime ?? null,
        p_sort: f.sort ?? (f.q ? "relevance" : "popularity"),
        p_page: f.page ?? 1,
        p_page_size: 24,
      }),
    placeholderData: (prev) => prev,
  });

export const facetsQuery = queryOptions({
  queryKey: ["facets"],
  queryFn: () => rpc<Facets>("movie_facets"),
  staleTime: 5 * 60_000,
});

export const peopleQuery = (q: string, role?: "actor" | "director") =>
  queryOptions({
    queryKey: ["people", q, role],
    queryFn: () => rpc<Person[]>("search_people", { q, p_role: role ?? null }),
    enabled: q.trim().length >= 2,
  });

export const similarQuery = (id: number) =>
  queryOptions({
    queryKey: ["similar", id],
    queryFn: () => rpc<Movie[]>("similar_movies", { p_id: id }),
  });

export function posterHue(id: number) {
  return (id * 47) % 360;
}

export function formatRuntime(min: number | null) {
  if (!min) return "";
  return min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min}m`;
}
