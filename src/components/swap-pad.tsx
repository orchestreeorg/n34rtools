"use client";

import { PriceChart } from "@/components/price-chart";
import { CONTRACTS, LAUNCH_NETWORK } from "@/lib/launch/contracts";
import {
  parseNearPrice,
  readPriceHistory,
  recordPrice,
  type PricePoint,
} from "@/lib/launch/price-history";
import type { PoolView, SwapQuote } from "@/lib/launch/pool";
import { executeRefSwap } from "@/lib/launch/swap";
import { useNearWallet } from "near-connect-hooks";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

export function SwapPad() {
  const wallet = useNearWallet();
  const params = useSearchParams();
  const contracts = CONTRACTS[LAUNCH_NETWORK];

  const [tokenId, setTokenId] = useState("carptoken.token.primitives.testnet");
  const [poolHint, setPoolHint] = useState<string | null>(null);
  const [pool, setPool] = useState<PoolView | null>(null);
  const [poolBusy, setPoolBusy] = useState(false);
  const [poolError, setPoolError] = useState<string | null>(null);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("0.1");
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txNote, setTxNote] = useState<string | null>(null);
  const [history, setHistory] = useState<PricePoint[]>([]);

  async function loadPool(id: string, hint = poolHint, silent = false) {
    if (!silent) {
      setPoolBusy(true);
      setQuote(null);
    }
    setPoolError(null);
    try {
      const search = new URLSearchParams({ tokenId: id });
      if (hint) search.set("poolId", hint);
      const response = await fetch(`/api/launch/pool?${search}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Pool not found");
      const next = payload as PoolView;
      setPool(next);
      const price = parseNearPrice(next.priceNearPerToken);
      if (price) setHistory(recordPrice(next.tokenId, price));
      else setHistory(readPriceHistory(next.tokenId));
    } catch (err) {
      setPool(null);
      setPoolError(err instanceof Error ? err.message : "Pool not found");
    } finally {
      setPoolBusy(false);
    }
  }

  useEffect(() => {
    const fromQuery = params.get("token");
    const poolFromQuery = params.get("pool");
    if (fromQuery) setTokenId(fromQuery);
    setPoolHint(poolFromQuery);
    void loadPool(fromQuery ?? tokenId.trim(), poolFromQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => {
    if (!pool || !amount.trim() || Number(amount) <= 0) {
      setQuote(null);
      return;
    }
    const handle = window.setTimeout(async () => {
      setQuoteError(null);
      try {
        const search = new URLSearchParams({
          tokenId: pool.tokenId,
          poolId: String(pool.poolId),
          amount,
          side,
        });
        const response = await fetch(`/api/launch/quote?${search}`);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Quote failed");
        setQuote(payload as SwapQuote);
      } catch (err) {
        setQuote(null);
        setQuoteError(err instanceof Error ? err.message : "Quote failed");
      }
    }, 250);
    return () => window.clearTimeout(handle);
  }, [amount, side, pool]);

  useEffect(() => {
    if (!pool) return;
    const tick = window.setInterval(() => {
      void loadPool(pool.tokenId, String(pool.poolId), true);
    }, 20_000);
    return () => window.clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool?.tokenId, pool?.poolId]);

  async function onLoad(event: FormEvent) {
    event.preventDefault();
    await loadPool(tokenId.trim());
  }

  async function onSwap() {
    if (!wallet.signedAccountId) {
      await wallet.signIn();
      return;
    }
    if (!quote) return;
    setBusy(true);
    setError(null);
    setTxNote(null);
    try {
      await executeRefSwap(wallet, quote);
      setTxNote(`Swapped ${quote.amountIn} ${side === "buy" ? "NEAR" : pool?.symbol} → ${quote.amountOut} ${side === "buy" ? pool?.symbol : "NEAR"}`);
      await loadPool(pool?.tokenId ?? tokenId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Swap failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-10 sm:px-8">
      <header className="space-y-3">
        <p className="font-mono text-xs tracking-[0.28em] text-ok uppercase">
          n34r.tools · testnet
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Swap
        </h1>
        <p className="max-w-2xl text-base leading-7 text-muted">
          Price and swap against Ref pool TOKEN / wNEAR on {contracts.amm}. You
          sign, we never hold keys.
        </p>
      </header>

      <form onSubmit={onLoad} className="rounded-2xl border border-line bg-panel/80 p-5 sm:p-6">
        <label className="block">
          <span className="mb-2 block font-mono text-xs tracking-wide text-muted uppercase">
            Token account
          </span>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={tokenId}
              onChange={(event) => setTokenId(event.target.value.toLowerCase())}
              spellCheck={false}
              className={inputClass}
              required
            />
            <button
              type="submit"
              disabled={poolBusy}
              className="rounded-xl bg-ok px-5 py-3 text-sm font-semibold text-background disabled:opacity-50"
            >
              {poolBusy ? "Loading…" : "Load pool"}
            </button>
          </div>
        </label>
        {poolError ? <p className="mt-3 text-sm text-block">{poolError}</p> : null}
      </form>

      {pool ? (
        <section className="rounded-2xl border border-ok/40 bg-panel/90 p-6">
          <div className="flex items-center gap-4">
            {pool.icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pool.icon}
                alt=""
                className="h-14 w-14 rounded-2xl border border-line object-cover"
              />
            ) : null}
            <div>
              <p className="font-mono text-xs tracking-[0.24em] text-ok">POOL #{pool.poolId}</p>
              <h2 className="mt-1 text-2xl text-white">
                {pool.name} / wNEAR
              </h2>
            </div>
          </div>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            <Stat label="Price" value={`1 ${pool.symbol} = ${pool.priceNearPerToken} Ⓝ`} />
            <Stat label="Inverse" value={`1 Ⓝ = ${pool.priceTokenPerNear} ${pool.symbol}`} />
            <Stat label={`${pool.symbol} reserve`} value={pool.tokenReserve} />
            <Stat label="wNEAR reserve" value={`${pool.nearReserve} Ⓝ`} />
          </dl>
          <div className="mt-5 rounded-xl border border-line bg-background px-3 py-3 sm:px-4">
            <PriceChart symbol={pool.symbol} points={history} />
            <p className="mt-2 font-mono text-[10px] text-muted">
              Charted in this browser from pool mid price. Ref&apos;s testnet
              indexer is down, so we sample on load, every 20s, and after swaps.
            </p>
          </div>
        </section>
      ) : null}

      {pool ? (
        <section className="rounded-2xl border border-line bg-panel/80 p-5 sm:p-6">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSide("buy")}
              className={`rounded-xl px-4 py-2 font-mono text-xs uppercase ${
                side === "buy" ? "bg-ok text-background" : "border border-line text-muted"
              }`}
            >
              Buy {pool.symbol}
            </button>
            <button
              type="button"
              onClick={() => setSide("sell")}
              className={`rounded-xl px-4 py-2 font-mono text-xs uppercase ${
                side === "sell" ? "bg-ok text-background" : "border border-line text-muted"
              }`}
            >
              Sell {pool.symbol}
            </button>
          </div>

          <label className="mt-5 block">
            <span className="mb-2 block font-mono text-xs tracking-wide text-muted uppercase">
              You pay ({side === "buy" ? "NEAR" : pool.symbol})
            </span>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              className={inputClass}
            />
          </label>

          <p className="mt-4 rounded-xl border border-line bg-background px-4 py-3 font-mono text-xs leading-6 text-muted">
            You receive:{" "}
            <span className="text-white">
              {quote
                ? `${quote.amountOut} ${side === "buy" ? pool.symbol : "NEAR"}`
                : "—"}
            </span>
            {quoteError ? <span className="block text-block">{quoteError}</span> : null}
          </p>

          <button
            type="button"
            onClick={() => void onSwap()}
            disabled={busy || !quote}
            className="mt-5 rounded-xl bg-ok px-5 py-3 text-sm font-semibold text-background disabled:opacity-50"
          >
            {busy
              ? "Swapping…"
              : wallet.signedAccountId
                ? `Swap ${side === "buy" ? "NEAR" : pool.symbol}`
                : "Connect and swap"}
          </button>
        </section>
      ) : null}

      {txNote ? (
        <p className="rounded-xl border border-ok/40 bg-ok/10 px-4 py-3 text-sm text-ok">{txNote}</p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-block/40 bg-block/10 px-4 py-3 text-sm text-block">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-line bg-background px-4 py-3 font-mono text-sm text-white outline-none ring-ok/40 placeholder:text-muted/60 focus:ring-2";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-background px-4 py-3">
      <dt className="font-mono text-[11px] tracking-wide text-muted uppercase">{label}</dt>
      <dd className="mt-1 font-mono text-sm text-white">{value}</dd>
    </div>
  );
}
