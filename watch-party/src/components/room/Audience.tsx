import { AnimatePresence, motion } from "framer-motion";
import { Crown, MonitorUp } from "lucide-react";
import type { MemberView } from "@/lib/useRoom";

export type Bubble = { text: string; id: string };
export type Reaction = { id: string; emoji: string; from: string; dx: number };

/** Seat row: each member's avatar with a cloud speech bubble above and floating reactions. */
export function Audience({
  members, hostId, sessionId, bubbles, reactions,
}: {
  members: MemberView[]; hostId: string; sessionId: string;
  bubbles: Record<string, Bubble | undefined>; reactions: Reaction[];
}) {
  return (
    <div className="flex flex-wrap items-end justify-center gap-x-6 gap-y-10 rounded-2xl bg-card/70 px-4 pb-4 pt-24">
      {members.map((m) => {
        const b = bubbles[m.sessionId];
        return (
          <div key={m.sessionId} className={`relative flex w-20 flex-col items-center ${m.online ? "" : "opacity-40"}`}>
            <AnimatePresence>
              {b && (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0, y: 10, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.9 }}
                  className="cloud absolute bottom-full mb-3 w-max max-w-[180px] break-words rounded-[1.5rem] bg-foreground px-3 py-2 text-center text-sm text-background shadow-soft"
                >
                  {b.text}
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {reactions.filter((r) => r.from === m.sessionId).map((r) => (
                <motion.span
                  key={r.id}
                  initial={{ opacity: 1, y: 0, x: 0, scale: 0.6 }}
                  animate={{ opacity: 0, y: -160, x: r.dx, scale: 1.6 }}
                  transition={{ duration: 2.2, ease: "easeOut" }}
                  className="pointer-events-none absolute top-0 z-20 text-3xl"
                >
                  {r.emoji}
                </motion.span>
              ))}
            </AnimatePresence>
            <div className="relative grid size-12 place-items-center rounded-full bg-primary font-display text-lg text-primary-foreground ring-2 ring-background">
              {m.name.slice(0, 1).toUpperCase()}
              {m.sessionId === hostId && <Crown className="absolute -top-3 size-4 text-primary" />}
              {m.sharing && <MonitorUp className="absolute -right-1 -bottom-1 size-4 rounded bg-background p-0.5 text-primary" />}
            </div>
            <span className="mt-1 max-w-full truncate text-xs">{m.name}{m.sessionId === sessionId && " (you)"}</span>
          </div>
        );
      })}
    </div>
  );
}
