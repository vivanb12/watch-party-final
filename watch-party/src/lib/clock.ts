import { rpc } from "./rpc";

type Sample = { rtt: number; offset: number };

/**
 * NTP-style clock sync against the database clock (the same clock that stamps
 * serverRefTime). Keeps the last 12 samples; offset = median of the
 * lowest-RTT half, which rejects samples skewed by queueing delay.
 */
export class ClockSync {
  samples: Sample[] = [];
  offset = 0;
  rtt = 0;
  ready = false;
  private timer: number | undefined;

  async ping() {
    const t0 = performance.now();
    const wall0 = Date.now();
    let server: number;
    try {
      server = Number(await rpc<number>("server_ms"));
    } catch {
      return;
    }
    const rtt = performance.now() - t0;
    this.samples.push({ rtt, offset: server - (wall0 + rtt / 2) });
    if (this.samples.length > 12) this.samples.shift();
    const best = [...this.samples].sort((a, b) => a.rtt - b.rtt).slice(0, Math.max(1, Math.ceil(this.samples.length / 2)));
    const offs = best.map((s) => s.offset).sort((a, b) => a - b);
    this.offset = offs[Math.floor(offs.length / 2)] ?? 0;
    this.rtt = best[0]?.rtt ?? 0;
    this.ready = true;
  }

  async start() {
    for (let i = 0; i < 5; i++) await this.ping();
    this.timer = window.setInterval(() => void this.ping(), 3000);
  }

  stop() {
    window.clearInterval(this.timer);
  }

  now() {
    return Date.now() + this.offset;
  }
}

export function expectedPosition(s: { playing: boolean; positionAtRef: number; serverRefTime: number }, serverNow: number) {
  return s.playing ? s.positionAtRef + (serverNow - s.serverRefTime) / 1000 : s.positionAtRef;
}
