import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Clapperboard, KeyRound } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TheatreSeats } from "@/components/TheatreSeats";
import { THEMES, type ThemeId } from "@/lib/themes";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Watch Party — pick your screen" },
      { name: "description", content: "Step into the theatre: start a romantic, sports or friends & family watch party, or join with a 6-character code." },
      { property: "og:title", content: "Watch Party — pick your screen" },
      { property: "og:description", content: "Synced movie nights with friends. Start a room or join with a code." },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const [zooming, setZooming] = useState<ThemeId | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [code, setCode] = useState("");

  const enter = (id: ThemeId) => {
    setZooming(id);
    setTimeout(() => navigate({ to: "/create/$theme", params: { theme: id } }), 650);
  };

  return (
    <main className="bg-night relative min-h-screen overflow-hidden">
      <div className="stars pointer-events-none absolute inset-0 opacity-70" />
      {/* curtains */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[9vw] rounded-r-[60px] bg-curtain shadow-soft" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-[9vw] rounded-l-[60px] bg-curtain shadow-soft" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-10 rounded-b-[40px] bg-curtain" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-[11vw] pt-14 sm:px-6">
        <div className="flex items-center gap-2">
          <Clapperboard className="size-6 text-primary" />
          <span className="font-display text-xl">Watch Party</span>
        </div>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/discover">Browse movies</Link>
          </Button>
          <Button size="sm" onClick={() => setJoinOpen(true)}>
            <KeyRound /> Join with code
          </Button>
        </nav>
      </header>

      <section className="relative z-10 mx-auto mt-8 max-w-5xl px-[11vw] sm:px-8">
        <div className="shadow-glow rounded-[2rem] bg-screen p-4 sm:p-6">
          <h1 className="text-center font-display text-3xl text-primary-foreground sm:text-5xl">Pick your screen</h1>
          <p className="mt-1 text-center text-sm text-primary-foreground/70">Everyone plays the film in sync. Grab a seat.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {(Object.keys(THEMES) as ThemeId[]).map((id) => {
              const t = THEMES[id];
              return (
                <motion.button
                  key={id}
                  layoutId={`screen-${id}`}
                  onClick={() => enter(id)}
                  whileHover={{ scale: 1.03, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  className="group relative aspect-video overflow-hidden rounded-2xl text-left shadow-soft focus:outline-none focus-visible:ring-4 focus-visible:ring-ring"
                >
                  <img src={t.image} alt={t.name} width={1536} height={864} className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/10 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <div className="font-display text-xl text-foreground">{t.name}</div>
                    <div className="text-xs text-foreground/75">{t.tagline}</div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="relative z-0 -mt-2 px-[9vw]">
        <TheatreSeats />
      </div>

      <AnimatePresence>
        {zooming && (
          <motion.div
            layoutId={`screen-${zooming}`}
            className="fixed inset-0 z-50 overflow-hidden"
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          >
            <img src={THEMES[zooming].image} alt="" className="size-full object-cover" />
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Join a watch party</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.length === 6) navigate({ to: "/room/$code", params: { code } });
            }}
          >
            <Input
              autoFocus
              value={code}
              maxLength={6}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              placeholder="ABC123"
              className="h-14 text-center font-mono text-3xl tracking-[0.4em]"
            />
            <Button type="submit" className="w-full" disabled={code.length !== 6}>
              Take me there
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
