"use client";

import { formatAxisPrice, type PricePoint } from "@/lib/launch/price-history";

const W = 640;
const H = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 56 };

export function PriceChart({
  symbol,
  points,
}: {
  symbol: string;
  points: PricePoint[];
}) {
  const series =
    points.length === 1
      ? [
          { t: points[0].t - 60_000, price: points[0].price },
          points[0],
        ]
      : points;

  if (series.length === 0) {
    return (
      <div className="flex h-52 items-center justify-center rounded-xl border border-line bg-background font-mono text-xs text-muted">
        Price will chart here as this browser sees updates.
      </div>
    );
  }

  const prices = series.map((p) => p.price);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const span = maxP - minP || maxP * 0.08 || 1e-12;
  const lo = Math.max(0, minP - span * 0.12);
  const hi = maxP + span * 0.12;
  const minT = series[0].t;
  const maxT = series[series.length - 1].t;
  const tSpan = Math.max(1, maxT - minT);

  const x = (t: number) =>
    PAD.left + ((t - minT) / tSpan) * (W - PAD.left - PAD.right);
  const y = (price: number) =>
    PAD.top + (1 - (price - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);

  const line = series
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)},${y(p.price).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${x(maxT).toFixed(1)},${H - PAD.bottom} L${x(minT).toFixed(1)},${H - PAD.bottom} Z`;
  const last = series[series.length - 1];
  const first = series[0];
  const delta = first.price === 0 ? 0 : ((last.price - first.price) / first.price) * 100;
  const up = delta >= 0;

  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-wide text-muted uppercase">
            Price · {symbol} / NEAR
          </p>
          <p className="mt-1 font-mono text-lg text-white">{formatAxisPrice(last.price)} Ⓝ</p>
        </div>
        <p className={`font-mono text-xs ${up ? "text-ok" : "text-block"}`}>
          {up ? "+" : ""}
          {delta.toFixed(2)}% this session
        </p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-52 w-full" role="img" aria-label={`${symbol} price`}>
        <defs>
          <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00EC97" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#00EC97" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((frac) => {
          const price = hi - (hi - lo) * frac;
          const yy = PAD.top + frac * (H - PAD.top - PAD.bottom);
          return (
            <g key={frac}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={yy}
                y2={yy}
                stroke="#1f3a2a"
                strokeWidth="1"
              />
              <text x={PAD.left - 8} y={yy + 4} textAnchor="end" fill="#8aa394" fontSize="10" fontFamily="monospace">
                {formatAxisPrice(price)}
              </text>
            </g>
          );
        })}
        <path d={area} fill="url(#priceFill)" />
        <path d={line} fill="none" stroke="#00EC97" strokeWidth="2" />
        <circle cx={x(last.t)} cy={y(last.price)} r="3.5" fill="#00EC97" />
        <text x={PAD.left} y={H - 8} fill="#8aa394" fontSize="10" fontFamily="monospace">
          {formatClock(minT)}
        </text>
        <text
          x={W - PAD.right}
          y={H - 8}
          textAnchor="end"
          fill="#8aa394"
          fontSize="10"
          fontFamily="monospace"
        >
          {formatClock(maxT)}
        </text>
      </svg>
    </div>
  );
}

function formatClock(t: number): string {
  const d = new Date(t);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm} UTC`;
}
