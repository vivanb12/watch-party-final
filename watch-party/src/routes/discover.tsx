import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Clapperboard, Play } from "lucide-react";
import { toast } from "sonner";
import { MovieBrowser } from "@/components/discovery/MovieBrowser";
import { Button } from "@/components/ui/button";
import { facetsQuery } from "@/lib/movies";
import { rpc } from "@/lib/rpc";
import { getSessionId } from "@/lib/session";
import type { RoomState } from "@/lib/useRoom";

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "Browse movies — Watch Party" },
      { name: "description", content: "Search the catalog with typo-tolerant search and filter by genre, actor, director, language, year, rating and runtime." },
      { property: "og:title", content: "Browse movies — Watch Party" },
      { property: "og:description", content: "Find tonight's movie with fuzzy search and smart filters." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(facetsQuery),
  component: Discover,
});

function Discover() {
  const navigate = useNavigate();
  const startWith = async (url: string, title: string, id: number) => {
    try {
      const room = await rpc<RoomState>("create_room", { p_session: getSessionId(), p_theme: "friends", p_video_url: url, p_video_title: title, p_movie_id: id });
      navigate({ to: "/room/$code", params: { code: room.code } });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <main className="bg-night min-h-screen">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5">
        <Link to="/" className="flex items-center gap-2">
          <Clapperboard className="size-6 text-primary" />
          <span className="font-display text-xl">Watch Party</span>
        </Link>
      </header>
      <div className="mx-auto max-w-7xl px-4 pb-16">
        <h1 className="mb-6 text-4xl">What are we watching?</h1>
        <MovieBrowser
          actions={(m) =>
            m.playableUrl ? (
              <Button onClick={() => startWith(m.playableUrl!, m.title, m.id)}>
                <Play /> Start a room with this
              </Button>
            ) : null
          }
        />
      </div>
    </main>
  );
}
