export type PricePoint = {
  t: number;
  price: number;
};

const PREFIX = "n34r.price.";
const MAX_POINTS = 200;
const MIN_GAP_MS = 5_000;

function key(tokenId: string): string {
  return `${PREFIX}${tokenId.trim().toLowerCase()}`;
}

export function parseNearPrice(value: string): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function readPriceHistory(tokenId: string): PricePoint[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key(tokenId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PricePoint[];
    return parsed.filter((p) => Number.isFinite(p.t) && Number.isFinite(p.price) && p.price > 0);
  } catch {
    return [];
  }
}

export function recordPrice(tokenId: string, price: number): PricePoint[] {
  if (typeof window === "undefined" || !Number.isFinite(price) || price <= 0) {
    return readPriceHistory(tokenId);
  }

  const now = Date.now();
  const existing = readPriceHistory(tokenId);
  const last = existing[existing.length - 1];
  if (last && now - last.t < MIN_GAP_MS && last.price === price) {
    return existing;
  }

  const next = [...existing, { t: now, price }].slice(-MAX_POINTS);
  window.localStorage.setItem(key(tokenId), JSON.stringify(next));
  return next;
}

export function formatAxisPrice(price: number): string {
  if (price >= 1) return price.toFixed(4).replace(/\.?0+$/, "");
  if (price >= 0.0001) return price.toPrecision(4);
  return price.toExponential(2);
}
