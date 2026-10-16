/** Flat-vector rows of red cinema seats seen from behind. */
export function TheatreSeats({ rows = 4 }: { rows?: number }) {
  return (
    <svg viewBox="0 0 1200 360" className="h-auto w-full" preserveAspectRatio="xMidYMax meet" aria-hidden>
      {Array.from({ length: rows }).map((_, r) => {
        const scale = 0.7 + r * 0.12;
        const w = 70 * scale;
        const gap = 12 * scale;
        const count = Math.floor(1200 / (w + gap)) + 1;
        const y = 40 + r * 75;
        const offset = (1200 - count * (w + gap)) / 2 + (r % 2 ? (w + gap) / 2 : 0);
        return (
          <g key={r}>
            {Array.from({ length: count }).map((__, i) => {
              const x = offset + i * (w + gap);
              return (
                <g key={i} transform={`translate(${x} ${y})`}>
                  <rect x={0} y={0} width={w} height={w * 0.95} rx={w * 0.28} className="fill-seat" />
                  <rect x={w * 0.08} y={w * 0.12} width={w * 0.84} height={w * 0.35} rx={w * 0.18} className="fill-seat-shadow opacity-40" />
                  <rect x={-w * 0.06} y={w * 0.55} width={w * 0.16} height={w * 0.5} rx={w * 0.08} className="fill-seat-shadow" />
                  <rect x={w * 0.9} y={w * 0.55} width={w * 0.16} height={w * 0.5} rx={w * 0.08} className="fill-seat-shadow" />
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
