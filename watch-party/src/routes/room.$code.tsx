import { createFileRoute, Link } from "@tanstack/react-router";
import { Copy, Film, MonitorUp, MonitorX, Pause, Play, Send, Users, Wifi, WifiOff } from "lucide-react";
import { Audience, type Bubble, type Reaction } from "@/components/room/Audience";
import { GroupPick, type GroupSuggestion } from "@/components/room/GroupPick";
import { useScreenShare } from "@/lib/useScreenShare";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MovieBrowser } from "@/components/discovery/MovieBrowser";
import { expectedPosition } from "@/lib/clock";
import { getProfile, saveProfile, type Profile } from "@/lib/session";
import { getTheme } from "@/lib/themes";
import { percentile, useDriftCorrection, type DriftMode } from "@/lib/useDrift";
import { useRoom } from "@/lib/useRoom";

export const Route = createFileRoute("/room/$code")({
  ssr: false,
  head: ({ params }) => ({
    meta: [
      { title: `Room ${params.code} — Watch Party` },
      { name: "description", content: "Join this synced watch party and watch together in real time." },
      { property: "og:title", content: `Room ${params.code} — Watch Party` },
      { property: "og:description", content: "Join this synced watch party and watch together in real time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RoomPage,
});

function RoomPage() {
  const { code } = Route.useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setProfile(getProfile());
    setReady(true);
  }, []);
  if (!ready) return null;
  if (!profile) return <NameGate onDone={(p) => { saveProfile(p); setProfile(p); }} />;
  return <Room code={code} profile={profile} />;
}

function NameGate({ onDone }: { onDone: (p: Profile) => void }) {
  const [name, setName] = useState("");
  return (
    <Dialog open>
      <DialogContent className="bg-card">
        <DialogHeader><DialogTitle className="font-display text-2xl">What should we call you?</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (name.trim()) onDone({ name: name.trim().slice(0, 24), color: "primary" }); }}>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          <Button type="submit" className="w-full" disabled={!name.trim()}>Take a seat</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Room({ code, profile }: { code: string; profile: Profile }) {
  const { channel, sessionId, state, notFound, connected, members, clock, command, admin, updateMe, propagation } = useRoom(code, profile);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [drift, setDrift] = useState<{ d: number; mode: DriftMode }>({ d: 0, mode: "paused" });
  const [browse, setBrowse] = useState(false);
  const lastReport = useRef(0);
  const [bubbles, setBubbles] = useState<Record<string, Bubble | undefined>>({});
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [chatLog, setChatLog] = useState<{ id: string; name: string; text: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [myPicks, setMyPicks] = useState<{ genres: string[]; moods: string[] }>({ genres: [], moods: [] });
  const [suggestions, setSuggestions] = useState<GroupSuggestion[]>([]);
  const shareVideo = useRef<HTMLVideoElement>(null);
  const sharer = members.find((m) => m.online && m.sharing)?.sessionId ?? null;
  const share = useScreenShare(channel, sessionId, sharer);
  const shownStream = share.localStream ?? share.remoteStream;

  useEffect(() => {
    if (shareVideo.current) shareVideo.current.srcObject = shownStream;
  }, [shownStream]);

  const showChat = useCallback((from: string, name: string, text: string) => {
    const id = crypto.randomUUID();
    setBubbles((b) => ({ ...b, [from]: { id, text } }));
    setChatLog((l) => [...l.slice(-49), { id, name, text }]);
    window.setTimeout(() => setBubbles((b) => (b[from]?.id === id ? { ...b, [from]: undefined } : b)), 6000);
  }, []);
  const showReaction = useCallback((from: string, emoji: string) => {
    const id = crypto.randomUUID();
    setReactions((r) => [...r, { id, from, emoji, dx: Math.random() * 60 - 30 }]);
    window.setTimeout(() => setReactions((r) => r.filter((x) => x.id !== id)), 2400);
  }, []);

  useEffect(() => {
    if (!channel) return;
    channel.on("broadcast", { event: "chat" }, ({ payload }) => showChat(payload.from, payload.name, payload.text));
    channel.on("broadcast", { event: "react" }, ({ payload }) => showReaction(payload.from, payload.emoji));
    channel.on("broadcast", { event: "suggest" }, ({ payload }) => setSuggestions(payload.items as GroupSuggestion[]));
  }, [channel, showChat, showReaction]);

  const sendChat = () => {
    const text = draft.trim().slice(0, 200);
    if (!text) return;
    setDraft("");
    showChat(sessionId, profile.name, text);
    void channel?.send({ type: "broadcast", event: "chat", payload: { from: sessionId, name: profile.name, text } });
  };
  const react = (emoji: string) => {
    showReaction(sessionId, emoji);
    void channel?.send({ type: "broadcast", event: "react", payload: { from: sessionId, emoji } });
  };

  useDriftCorrection(videoRef, state, clock, !!state?.videoUrl, (d, mode) => {
    setDrift({ d, mode });
    if (Date.now() - lastReport.current > 2000) {
      lastReport.current = Date.now();
      updateMe({ drift: Math.round(d * 1000), seated: true });
    }
  });

  if (notFound) {
    return (
      <main className="bg-night grid min-h-screen place-items-center p-6 text-center">
        <div>
          <h1 className="font-display text-3xl">Room {code} not found</h1>
          <Button asChild className="mt-4"><Link to="/">Back to the theatre</Link></Button>
        </div>
      </main>
    );
  }
  if (!state) return <main className="bg-night grid min-h-screen place-items-center"><p className="animate-pulse">Connecting…</p></main>;

  const t = getTheme(state.theme);
  const isHost = state.hostId === sessionId;
  const canControl = state.controlMode === "everyone" || isHost;
  const pos = () => videoRef.current?.currentTime ?? expectedPosition(state, clock.now());
  const p95 = Math.round((percentile(propagation, 95) as number | undefined) ?? 0);

  return (
    <main className="relative min-h-screen">
      <img src={t.image} alt="" className="fixed inset-0 -z-10 size-full object-cover opacity-30" />
      <header className="flex flex-wrap items-center justify-between gap-2 p-4">
        <Link to="/" className="font-display text-xl">Watch Party</Link>
        <div className="flex items-center gap-2">
          <span className={`font-display ${t.accent}`}>{t.name}</span>
          <Button size="sm" variant="secondary" onClick={() => { void navigator.clipboard.writeText(window.location.href); toast("Invite link copied"); }}>
            <Copy /> {code}
          </Button>
          {connected ? <Wifi className="size-4 text-success" /> : <WifiOff className="size-4 text-destructive" />}
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[1fr_300px]">
        <section className="space-y-3">
          <div className={`overflow-hidden rounded-2xl bg-background shadow-soft ring-2 ${t.ring}`}>
            {shownStream ? (
              <video ref={shareVideo} autoPlay playsInline muted={!!share.localStream} className="aspect-video w-full bg-background" />
            ) : state.videoUrl ? (
              <video ref={videoRef} src={state.videoUrl} className="aspect-video w-full" playsInline
                onWaiting={() => updateMe({ buffering: true })} onPlaying={() => updateMe({ buffering: false })} />
            ) : (
              <div className="grid aspect-video place-items-center text-muted-foreground">No movie loaded</div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={!canControl} onClick={() => command(state.playing ? "pause" : "play", { position: pos() })}>
              {state.playing ? <Pause /> : <Play />} {state.playing ? "Pause" : "Play"}
            </Button>
            {isHost && (share.localStream ? (
              <Button variant="destructive" onClick={() => { share.stop(); updateMe({ sharing: false }); }}><MonitorX /> Stop sharing</Button>
            ) : (
              <Button variant="outline" onClick={async () => {
                try { await share.start(); updateMe({ sharing: true }); } catch { toast("Screen share was cancelled"); }
              }}><MonitorUp /> Share screen</Button>
            ))}
            <span className="ml-auto text-sm text-muted-foreground">{state.videoTitle}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-card/80 p-3 text-center text-xs">
            <div><div className="font-mono text-lg">{Math.round(drift.d * 1000)} ms</div>drift ({drift.mode})</div>
            <div><div className="font-mono text-lg">{p95} ms</div>p95 propagation</div>
            <div><div className="font-mono text-lg">{Math.round(clock.rtt)} ms</div>clock RTT</div>
          </div>
        </section>

        <aside className="space-y-3 rounded-2xl bg-card/90 p-4">
          <div className="flex items-center gap-2 font-display text-lg"><Users className="size-5" /> {members.filter((m) => m.online).length} watching</div>
          {isHost && members.filter((m) => m.online && m.sessionId !== sessionId).map((m) => (
            <div key={m.sessionId} className="flex items-center justify-between text-xs">
              <span className="truncate">{m.name}{m.drift != null && ` · ${m.drift}ms`}</span>
              <Button size="sm" variant="ghost" onClick={() => admin("transfer", m.sessionId)}>Make host</Button>
            </div>
          ))}
          <div className="h-40 space-y-1 overflow-y-auto rounded-lg bg-background/40 p-2 text-sm">
            {chatLog.length === 0 && <p className="text-xs text-muted-foreground">Say hi — your message pops up above your seat.</p>}
            {chatLog.map((c) => <p key={c.id}><b>{c.name}:</b> {c.text}</p>)}
          </div>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); sendChat(); }}>
            <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Chat…" maxLength={200} />
            <Button size="icon" type="submit" aria-label="Send"><Send /></Button>
          </form>
          <div className="flex justify-between">
            {["😂", "😍", "😱", "👏", "🔥", "😭"].map((e) => (
              <button key={e} onClick={() => react(e)} className="text-2xl transition hover:scale-125" aria-label={`React ${e}`}>{e}</button>
            ))}
          </div>
          {isHost && (
            <Button size="sm" variant="outline" className="w-full" onClick={() => admin("mode", undefined, state.controlMode === "everyone" ? "host" : "everyone")}>
              Controls: {state.controlMode === "everyone" ? "everyone" : "host only"}
            </Button>
          )}
        </aside>
        <div className="lg:col-span-1">
          <Audience members={members} hostId={state.hostId} sessionId={sessionId} bubbles={bubbles} reactions={reactions} />
        </div>
        <GroupPick
          members={members}
          myPicks={myPicks}
          onPicks={(p) => { setMyPicks(p); updateMe({ picks: p }); }}
          suggestions={suggestions}
          onSuggestions={(items) => { setSuggestions(items); void channel?.send({ type: "broadcast", event: "suggest", payload: { items } }); }}
          canControl={canControl}
          onPlay={(m) => void command("load", { url: m.playableUrl!, title: m.title, movieId: m.id })}
        />
      </div>

      <Sheet open={browse} onOpenChange={setBrowse}>
        <SheetContent side="bottom" className="h-[85vh] overflow-y-auto bg-background">
          <SheetHeader><SheetTitle className="font-display text-2xl">Pick a movie</SheetTitle></SheetHeader>
          <MovieBrowser
            actions={(m) =>
              m.playableUrl ? (
                <Button onClick={() => { void command("load", { url: m.playableUrl!, title: m.title, movieId: m.id }); setBrowse(false); }}>
                  <Play /> Play in this room
                </Button>
              ) : null
            }
          />
        </SheetContent>
      </Sheet>
    </main>
  );
}
