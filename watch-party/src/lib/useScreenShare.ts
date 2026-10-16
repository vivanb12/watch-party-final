import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

const ICE: RTCConfiguration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }] };

type Signal = { to: string; from: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };

/**
 * Host screen share over WebRTC (one peer connection per viewer),
 * signalled through the room's realtime channel.
 */
export function useScreenShare(channel: RealtimeChannel | null, sessionId: string, sharerId: string | null) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const peers = useRef(new Map<string, RTCPeerConnection>());
  const localRef = useRef<MediaStream | null>(null);

  const send = useCallback((event: string, payload: object) => {
    void channel?.send({ type: "broadcast", event, payload });
  }, [channel]);

  const closeAll = useCallback(() => {
    for (const pc of peers.current.values()) pc.close();
    peers.current.clear();
  }, []);

  const makePeer = useCallback((remote: string) => {
    peers.current.get(remote)?.close();
    const pc = new RTCPeerConnection(ICE);
    pc.onicecandidate = (e) => e.candidate && send("ss-signal", { to: remote, from: sessionId, candidate: e.candidate.toJSON() });
    pc.ontrack = (e) => setRemoteStream(e.streams[0] ?? null);
    peers.current.set(remote, pc);
    return pc;
  }, [send, sessionId]);

  // host: offer to a viewer
  const offerTo = useCallback(async (viewer: string) => {
    const stream = localRef.current;
    if (!stream) return;
    const pc = makePeer(viewer);
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    await pc.setLocalDescription(await pc.createOffer());
    send("ss-signal", { to: viewer, from: sessionId, sdp: pc.localDescription!.toJSON() });
  }, [makePeer, send, sessionId]);

  useEffect(() => {
    if (!channel) return;
    channel.on("broadcast", { event: "ss-join" }, ({ payload }) => {
      if (localRef.current) void offerTo((payload as { from: string }).from);
    });
    channel.on("broadcast", { event: "ss-stop" }, () => {
      closeAll();
      setRemoteStream(null);
    });
    channel.on("broadcast", { event: "ss-signal" }, async ({ payload }) => {
      const s = payload as Signal;
      if (s.to !== sessionId) return;
      try {
        if (s.sdp?.type === "offer") {
          const pc = makePeer(s.from);
          await pc.setRemoteDescription(s.sdp);
          await pc.setLocalDescription(await pc.createAnswer());
          send("ss-signal", { to: s.from, from: sessionId, sdp: pc.localDescription!.toJSON() });
        } else if (s.sdp?.type === "answer") {
          await peers.current.get(s.from)?.setRemoteDescription(s.sdp);
        } else if (s.candidate) {
          await peers.current.get(s.from)?.addIceCandidate(s.candidate);
        }
      } catch {
        /* stale signal */
      }
    });
  }, [channel, sessionId, offerTo, makePeer, send, closeAll]);

  // viewer: ask to join whenever someone else starts sharing
  useEffect(() => {
    if (!channel || !sharerId || sharerId === sessionId) {
      if (!sharerId) setRemoteStream(null);
      return;
    }
    const t = window.setTimeout(() => send("ss-join", { from: sessionId }), 300);
    return () => window.clearTimeout(t);
  }, [channel, sharerId, sessionId, send]);

  const stop = useCallback(() => {
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    setLocalStream(null);
    closeAll();
    send("ss-stop", { from: sessionId });
  }, [closeAll, send, sessionId]);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    localRef.current = stream;
    setLocalStream(stream);
    stream.getVideoTracks()[0]?.addEventListener("ended", stop);
    return stream;
  }, [stop]);

  useEffect(() => () => {
    localRef.current?.getTracks().forEach((t) => t.stop());
    closeAll();
  }, [closeAll]);

  return { localStream, remoteStream, start, stop };
}
