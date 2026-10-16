import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ClockSync } from "./clock";
import { rpc } from "./rpc";
import { getSessionId, type Profile } from "./session";

export type RoomState = {
  code: string;
  version: number;
  playing: boolean;
  positionAtRef: number;
  serverRefTime: number;
  hostId: string;
  controlMode: "everyone" | "host";
  videoUrl: string | null;
  videoTitle: string | null;
  movieId: number | null;
  theme: string;
  locked: boolean;
  serverNow?: number;
  applied?: boolean;
};

export type Member = {
  sessionId: string;
  name: string;
  color: string;
  joinedAt: number;
  seated: boolean;
  buffering: boolean;
  drift: number | null;
  file: { name: string; size: number } | null;
  sharing?: boolean;
  picks?: { genres: string[]; moods: string[] };
};

export type MemberView = Member & { online: boolean; lastSeen: number };

type Broadcast = RoomState & { clickAt?: number; heartbeat?: boolean; by?: string; action?: string };

export const GRACE_MS = 12_000;

export function useRoom(code: string, profile: Profile | null) {
  const sessionId = useMemo(() => getSessionId(), []);
  const [state, setState] = useState<RoomState | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [connected, setConnected] = useState(false);
  const [members, setMembers] = useState<MemberView[]>([]);
  const [propagation, setPropagation] = useState<number[]>([]);
  const stateRef = useRef<RoomState | null>(null);
  const clock = useRef(new ClockSync()).current;
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const roster = useRef(new Map<string, MemberView>());
  const lastStateAt = useRef(Date.now());
  const hostMissingSince = useRef<number | null>(null);
  const me = useRef<Member>({
    sessionId,
    name: profile?.name ?? "Guest",
    color: profile?.color ?? "primary",
    joinedAt: Date.now(),
    seated: false,
    buffering: false,
    drift: null,
    file: null,
  });

  const apply = useCallback((s: RoomState | null | undefined) => {
    if (!s) return false;
    const cur = stateRef.current;
    if (cur && s.version <= cur.version) return false;
    stateRef.current = s;
    lastStateAt.current = Date.now();
    setState(s);
    return true;
  }, []);

  const publishRoster = useCallback(() => {
    setMembers([...roster.current.values()].sort((a, b) => a.joinedAt - b.joinedAt));
  }, []);

  const broadcast = useCallback((payload: Broadcast) => {
    void channelRef.current?.send({ type: "broadcast", event: "state", payload });
  }, []);

  // ---- connection lifecycle ----
  useEffect(() => {
    let alive = true;
    void clock.start();
    rpc<RoomState | null>("get_room", { p_code: code })
      .then((s) => {
        if (!alive) return;
        if (!s) setNotFound(true);
        else apply(s);
      })
      .catch(() => setNotFound(true));

    const ch = supabase.channel(`room:${code}`, {
      config: { presence: { key: sessionId }, broadcast: { self: false } },
    });
    ch.on("broadcast", { event: "state" }, ({ payload }) => {
      const p = payload as Broadcast;
      lastStateAt.current = Date.now();
      if (apply(p) && p.clickAt && !p.heartbeat) {
        const ms = clock.now() - p.clickAt;
        setPropagation((arr) => [...arr.slice(-49), ms]);
      }
    });
    ch.on("presence", { event: "sync" }, () => {
      const ps = ch.presenceState<Member>();
      const now = Date.now();
      const online = new Set<string>();
      for (const metas of Object.values(ps)) {
        const m = metas[metas.length - 1];
        if (!m?.sessionId) continue;
        online.add(m.sessionId);
        roster.current.set(m.sessionId, { ...m, online: true, lastSeen: now });
      }
      for (const [id, m] of roster.current) {
        if (!online.has(id) && m.online) roster.current.set(id, { ...m, online: false, lastSeen: now });
      }
      publishRoster();
    });
    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        setConnected(true);
        await ch.track(me.current);
        // re-handshake: pull authoritative snapshot after every (re)connect
        try {
          const s = await rpc<RoomState>("get_room", { p_code: code });
          if (s && stateRef.current && s.version < stateRef.current.version) return;
          if (s) {
            stateRef.current = null;
            apply(s);
          }
        } catch {
          /* retried by watchdog */
        }
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        setConnected(false);
      }
    });
    channelRef.current = ch;
    setChannel(ch);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void rpc<RoomState>("get_room", { p_code: code }).then(apply);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);

    return () => {
      alive = false;
      clock.stop();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
      void supabase.removeChannel(ch);
      channelRef.current = null;
      setChannel(null);
    };
  }, [code, sessionId, apply, clock, publishRoster]);

  // ---- heartbeat (host), watchdog (everyone), grace pruning, auto host-claim ----
  useEffect(() => {
    const t = window.setInterval(async () => {
      const s = stateRef.current;
      const now = Date.now();
      // prune members past grace period
      let changed = false;
      for (const [id, m] of roster.current) {
        if (!m.online && now - m.lastSeen > GRACE_MS) {
          roster.current.delete(id);
          changed = true;
        }
      }
      if (changed) publishRoster();
      if (!s) return;

      if (s.hostId === sessionId) {
        try {
          const fresh = await rpc<RoomState>("get_room", { p_code: code });
          apply(fresh);
          broadcast({ ...(stateRef.current ?? fresh), heartbeat: true });
        } catch {
          /* ignore */
        }
      } else if (now - lastStateAt.current > 6000) {
        try {
          apply(await rpc<RoomState>("get_room", { p_code: code }));
          lastStateAt.current = now;
        } catch {
          /* ignore */
        }
      }

      // automatic host handoff: host gone past grace → longest-present member claims
      const host = roster.current.get(s.hostId);
      const hostOnline = host?.online ?? false;
      if (hostOnline || s.hostId === sessionId) {
        hostMissingSince.current = null;
      } else {
        hostMissingSince.current ??= now;
        if (now - hostMissingSince.current > GRACE_MS) {
          const candidates = [...roster.current.values()].filter((m) => m.online).sort((a, b) => a.joinedAt - b.joinedAt);
          if (candidates[0]?.sessionId === sessionId) {
            hostMissingSince.current = null;
            const res = await rpc<RoomState>("room_admin", { p_code: code, p_session: sessionId, p_action: "claim", p_target: s.hostId });
            if (apply(res)) {
              broadcast({ ...res });
              toast("You're the host now", { description: "The previous host left." });
            }
          }
        }
      }
    }, 2000);
    return () => window.clearInterval(t);
  }, [code, sessionId, apply, broadcast, publishRoster]);

  const updateMe = useCallback((patch: Partial<Member>) => {
    me.current = { ...me.current, ...patch };
    void channelRef.current?.track(me.current);
  }, []);

  const command = useCallback(
    async (action: "play" | "pause" | "seek" | "load", opts: { position?: number; url?: string; title?: string; movieId?: number | null } = {}) => {
      const cur = stateRef.current;
      if (!cur) return null;
      const clickAt = clock.now();
      try {
        const res = await rpc<RoomState>("room_command", {
          p_code: code,
          p_session: sessionId,
          p_version: cur.version,
          p_action: action,
          p_position: opts.position ?? null,
          p_video_url: opts.url ?? null,
          p_video_title: opts.title ?? null,
          p_movie_id: opts.movieId ?? null,
        });
        apply(res);
        if (res.applied) broadcast({ ...res, clickAt, by: sessionId, action });
        else if (res.controlMode === "host" && res.hostId !== sessionId) toast("Only the host can control playback right now");
        else toast("Someone else acted first", { description: "You're synced to the latest state." });
        return res;
      } catch (e) {
        toast.error("Command failed", { description: (e as Error).message });
        return null;
      }
    },
    [code, sessionId, apply, broadcast, clock],
  );

  const admin = useCallback(
    async (action: "transfer" | "mode" | "lock", target?: string, value?: string) => {
      const res = await rpc<RoomState>("room_admin", { p_code: code, p_session: sessionId, p_action: action, p_target: target ?? null, p_value: value ?? null });
      if (apply(res)) broadcast({ ...res });
      return res;
    },
    [code, sessionId, apply, broadcast],
  );

  return { channel, sessionId, state, notFound, connected, members, clock, command, admin, updateMe, propagation };
}
