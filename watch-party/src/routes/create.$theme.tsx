import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { rpc } from "@/lib/rpc";
import { getSessionId } from "@/lib/session";
import { getTheme } from "@/lib/themes";
import type { RoomState } from "@/lib/useRoom";

const DEFAULT_VIDEO = {
  url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  title: "Big Buck Bunny",
  movieId: 1,
};

export const Route = createFileRoute("/create/$theme")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Setting up your room — Watch Party" },
      { name: "description", content: "Creating a new watch party room." },
      { property: "og:title", content: "Setting up your room — Watch Party" },
      { property: "og:description", content: "Creating a new watch party room." },
    ],
  }),
  component: CreateRoom,
});

function CreateRoom() {
  const { theme } = Route.useParams();
  const navigate = useNavigate();
  const t = getTheme(theme);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    rpc<RoomState>("create_room", {
      p_session: getSessionId(),
      p_theme: t.id,
      p_video_url: DEFAULT_VIDEO.url,
      p_video_title: DEFAULT_VIDEO.title,
      p_movie_id: DEFAULT_VIDEO.movieId,
    })
      .then((room) => navigate({ to: "/room/$code", params: { code: room.code }, replace: true }))
      .catch((e: Error) => {
        toast.error("Couldn't create the room", { description: e.message });
        navigate({ to: "/" });
      });
  }, [navigate, t.id]);

  return (
    <div className="fixed inset-0">
      <img src={t.image} alt="" className="size-full object-cover" />
      <div className="absolute inset-0 grid place-items-center bg-background/40">
        <p className="animate-pulse font-display text-2xl">Opening the {t.name} screen…</p>
      </div>
    </div>
  );
}
