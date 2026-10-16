import { useEffect, useRef, type RefObject } from "react";
import { expectedPosition, type ClockSync } from "./clock";
import type { RoomState } from "./useRoom";

export const DRIFT_IGNORE = 0.04; // s
export const DRIFT_HARD = 1.5; // s

export type DriftMode = "locked" | "nudge" | "seek" | "paused";

/**
 * Drift correction loop (every 200 ms):
 *  |drift| < 40 ms  → ignore (rate 1.0)
 *  40 ms – 1.5 s    → nudge playbackRate to 0.95 / 1.05
 *  > 1.5 s          → hard seek to the expected position
 */
export function useDriftCorrection(
  videoRef: RefObject<HTMLVideoElement | null>,
  state: RoomState | null,
  clock: ClockSync,
  enabled: boolean,
  onSample: (driftSeconds: number, mode: DriftMode) => void,
) {
  const stateRef = useRef(state);
  stateRef.current = state;
  const cb = useRef(onSample);
  cb.current = onSample;

  useEffect(() => {
    if (!enabled) return;
    const t = window.setInterval(() => {
      const v = videoRef.current;
      const s = stateRef.current;
      if (!v || !s || v.readyState < 1 || v.seeking) return;
      const dur = Number.isFinite(v.duration) ? v.duration : Infinity;
      const target = Math.min(expectedPosition(s, clock.now()), dur);

      if (!s.playing || target >= dur - 0.05) {
        if (!v.paused) v.pause();
        v.playbackRate = 1;
        if (Math.abs(v.currentTime - target) > 0.1) v.currentTime = target;
        cb.current(v.currentTime - target, "paused");
        return;
      }
      if (v.paused) {
        v.currentTime = target;
        void v.play().catch(() => {});
        cb.current(0, "seek");
        return;
      }
      const d = v.currentTime - target;
      const ad = Math.abs(d);
      if (ad > DRIFT_HARD) {
        v.currentTime = target;
        v.playbackRate = 1;
        cb.current(d, "seek");
      } else if (ad > DRIFT_IGNORE) {
        v.playbackRate = d > 0 ? 0.95 : 1.05;
        cb.current(d, "nudge");
      } else {
        v.playbackRate = 1;
        cb.current(d, "locked");
      }
    }, 200);
    return () => window.clearInterval(t);
  }, [enabled, videoRef, clock]);
}

export function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] ?? 0;
}
