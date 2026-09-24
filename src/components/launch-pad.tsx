"use client";

import {
  CONTRACTS,
  LAUNCH_NETWORK,
  estimatePoolNear,
  predictedTokenId,
  tokenIcon,
} from "@/lib/launch/contracts";
import { buildCreateTokenPlan } from "@/lib/launch/create-token";
import { fileToTokenIcon } from "@/lib/launch/icon";
import type { LaunchedToken } from "@/lib/launch/list-tokens";
import { seedRefPool } from "@/lib/launch/seed-pool";
import { useNearWallet } from "near-connect-hooks";
import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Step = "form" | "seed" | "done";

type SeedTarget = {
  tokenId: string;
  name: string;
  symbol: string;
  supply: string;
  icon: string | null;
  ownerId: string;
};

export function LaunchPad() {
  const wallet = useNearWallet();
  const contracts = CONTRACTS[LAUNCH_NETWORK];

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [supply, setSupply] = useState("1000000000");
  const [icon, setIcon] = useState<string | null>(null);
  const [iconBusy, setIconBusy] = useState(false);
  const [liquidityNear, setLiquidityNear] = useState("1");
  const [lpPercent, setLpPercent] = useState(80);
  const [step, setStep] = useState<Step>("form");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seedTarget, setSeedTarget] = useState<SeedTarget | null>(null);
  const [poolId, setPoolId] = useState<number | null>(null);
  const [launched, setLaunched] = useState<LaunchedToken[]>([]);
  const [listBusy, setListBusy] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);

  const previewId = symbol.trim() ? predictedTokenId(symbol.trim().toLowerCase()) : "";
  const previewIcon = useMemo(
    () => icon ?? (symbol.trim() ? tokenIcon(symbol.trim().toLowerCase()) : null),
    [icon, symbol],
  );
  const poolEstimate = useMemo(() => estimatePoolNear(liquidityNear), [liquidityNear]);

  async function loadLaunched(accountId: string) {
    setListBusy(true);
    setListError(null);
    try {
      const response = await fetch(
        `/api/launch/tokens?accountId=${encodeURIComponent(accountId)}`,
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not load tokens");
      }
      setLaunched(Array.isArray(payload.tokens) ? payload.tokens : []);
    } catch (err) {
      setLaunched([]);
      setListError(err instanceof Error ? err.message : "Could not load tokens");
    } finally {
      setListBusy(false);
    }
  }

  useEffect(() => {
    if (!wallet.signedAccountId) {
      setLaunched([]);
      setListError(null);
      return;
    }
    void loadLaunched(wallet.signedAccountId);
  }, [wallet.signedAccountId]);

  async function createToken() {
    if (!wallet.signedAccountId) {
      await wallet.signIn();
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const check = await fetch("/api/launch/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol }),
      });
      const availability = await check.json();
      if (!check.ok || !availability.ok) {
        throw new Error(availability.reason ?? availability.error ?? "Symbol is not available");
      }

      const plan = buildCreateTokenPlan({
        ownerId: wallet.signedAccountId,
        name,
        symbol,
        supply,
        icon: icon ?? undefined,
      });

      await wallet.callFunction({
        contractId: plan.factory,
        method: "create_token",
        args: plan.args,
        gas: plan.gas,
        deposit: plan.deposit,
      });

      setSeedTarget({
        tokenId: plan.tokenId,
        name: name.trim(),
        symbol: symbol.trim().toLowerCase(),
        supply: supply.trim(),
        ownerId: wallet.signedAccountId,
        icon: plan.args.args.metadata.icon,
      });
      setPoolId(null);
      setStep("seed");
      void loadLaunched(wallet.signedAccountId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Token create failed");
    } finally {
      setBusy(false);
    }
  }

  async function seedPool() {
    if (!wallet.signedAccountId) {
      await wallet.signIn();
      return;
    }
    if (!seedTarget) return;

    setBusy(true);
    setError(null);
    try {
      const result = await seedRefPool(wallet, {
        tokenId: seedTarget.tokenId,
        supply: seedTarget.supply,
        liquidityNear,
        lpPercent,
      });
      setPoolId(result.poolId);
      setStep("done");
      void loadLaunched(wallet.signedAccountId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pool seed failed");
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void createToken();
  }

  function resetForm() {
    setStep("form");
    setSeedTarget(null);
    setPoolId(null);
    setError(null);
    setName("");
    setSymbol("");
    setSupply("1000000000");
    setIcon(null);
    setLiquidityNear("1");
    setLpPercent(80);
    if (iconInputRef.current) iconInputRef.current.value = "";
  }

  function startSeedFromList(token: LaunchedToken) {
    if (!wallet.signedAccountId) return;
    setSeedTarget({
      tokenId: token.tokenId,
      name: token.name,
      symbol: token.symbol,
      supply: token.balance.replace(/,/g, ""),
      icon: token.icon,
      ownerId: wallet.signedAccountId,
    });
    setPoolId(null);
    setError(null);
    setStep("seed");
  }

  async function onIconChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setIcon(null);
      return;
    }

    setIconBusy(true);
    setError(null);
    try {
      setIcon(await fileToTokenIcon(file));
    } catch (err) {
      setIcon(null);
      event.target.value = "";
      setError(err instanceof Error ? err.message : "Could not read that image.");
    } finally {
      setIconBusy(false);
    }
  }

  function clearIcon() {
    setIcon(null);
    if (iconInputRef.current) iconInputRef.current.value = "";
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-10 sm:px-8">
      <header className="space-y-3">
        <p className="font-mono text-xs tracking-[0.28em] text-ok uppercase">
          n34r.tools · testnet
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Launch
        </h1>
        <p className="max-w-2xl text-base leading-7 text-muted">
          Create a fixed-supply NEP-141 token, then seed a TOKEN / wNEAR pool on
          Ref Finance ({contracts.amm}). Their testnet UI is often down — the
          pool lives on-chain. You sign, we never hold keys.
        </p>
      </header>

      <ol className="grid gap-3 sm:grid-cols-3">
        <StepChip n={1} label="Create token" active={step === "form"} done={step !== "form"} />
        <StepChip n={2} label="Seed Ref pool" active={step === "seed"} done={step === "done"} />
        <StepChip n={3} label="Pool live" active={step === "done"} done={false} />
      </ol>

      {step === "form" ? (
        <form onSubmit={onSubmit} className="rounded-2xl border border-line bg-panel/80 p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Frog Coin"
                className={inputClass}
                required
              />
            </Field>
            <Field label="Symbol">
              <input
                value={symbol}
                onChange={(event) => setSymbol(event.target.value.toLowerCase())}
                placeholder="frog"
                spellCheck={false}
                autoCapitalize="none"
                className={inputClass}
                required
              />
            </Field>
            <Field label="Total supply">
              <input
                value={supply}
                onChange={(event) => setSupply(event.target.value)}
                inputMode="decimal"
                className={inputClass}
                required
              />
            </Field>
            <div className="sm:col-span-2">
              <span className="mb-2 block font-mono text-xs tracking-wide text-muted uppercase">
                Icon
              </span>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line bg-background">
                  {previewIcon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewIcon} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-mono text-[10px] text-muted">64×64</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="cursor-pointer rounded-xl border border-line px-4 py-2 font-mono text-xs text-white uppercase hover:border-ok/40">
                      {iconBusy ? "Processing…" : icon ? "Replace image" : "Upload image"}
                      <input
                        ref={iconInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                        onChange={(event) => void onIconChange(event)}
                        className="sr-only"
                      />
                    </label>
                    {icon ? (
                      <button
                        type="button"
                        onClick={clearIcon}
                        className="rounded-xl border border-line px-4 py-2 font-mono text-xs text-muted uppercase hover:text-white"
                      >
                        Use default
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-2 font-mono text-[11px] leading-5 text-muted">
                    Optional. PNG, JPEG, WebP, GIF, or SVG. We shrink it to 64×64
                    and store a data URL on-chain. Skip to use a generated stamp.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {previewId ? (
            <p className="mt-4 font-mono text-xs text-muted">
              Token account: <span className="text-white">{previewId}</span>
            </p>
          ) : null}

          <p className="mt-4 rounded-xl border border-line bg-background px-4 py-3 font-mono text-xs leading-6 text-muted">
            You will sign one wallet flow and spend about{" "}
            <span className="text-ok">2.23 Ⓝ</span> for the factory deposit plus
            gas. Pool seed is the next step and needs extra testnet NEAR.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-ok px-5 py-3 text-sm font-semibold text-background disabled:opacity-50"
            >
              {busy
                ? "Creating…"
                : wallet.signedAccountId
                  ? "Create token"
                  : "Connect and create"}
            </button>
          </div>
        </form>
      ) : null}

      {step === "seed" && seedTarget ? (
        <section className="rounded-2xl border border-ok/40 bg-panel/90 p-6">
          <p className="font-mono text-xs tracking-[0.24em] text-ok">SEED REF POOL</p>
          <div className="mt-3 flex items-center gap-4">
            {seedTarget.icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={seedTarget.icon}
                alt=""
                className="h-16 w-16 rounded-2xl border border-line bg-background object-cover"
              />
            ) : null}
            <div>
              <h2 className="text-2xl text-white">{seedTarget.name}</h2>
              <p className="mt-1 font-mono text-xs text-muted">{seedTarget.tokenId}</p>
            </div>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted">
            Wrap NEAR, deposit both sides into {contracts.amm}, and add
            liquidity. You will sign several wallet calls. Keep this tab open.
            Ref&apos;s testnet site may not list the pool.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="NEAR to pair (min 1)">
              <input
                value={liquidityNear}
                onChange={(event) => setLiquidityNear(event.target.value)}
                inputMode="decimal"
                className={inputClass}
              />
            </Field>
            <label className="block">
              <span className="mb-2 flex justify-between font-mono text-xs tracking-wide text-muted uppercase">
                <span>Balance sent to the pool</span>
                <span>{lpPercent}%</span>
              </span>
              <input
                type="range"
                min={10}
                max={95}
                value={lpPercent}
                onChange={(event) => setLpPercent(Number(event.target.value))}
                className="mt-3 w-full accent-ok"
              />
            </label>
          </div>

          <p className="mt-4 rounded-xl border border-line bg-background px-4 py-3 font-mono text-xs leading-6 text-muted">
            About <span className="text-ok">{poolEstimate} Ⓝ</span> (storage plus
            the {liquidityNear || "0"} Ⓝ you pair). Pair is{" "}
            {seedTarget.symbol} / wNEAR at {contracts.poolFee / 100}% fee.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void seedPool()}
              disabled={busy || Number(liquidityNear) < 1}
              className="rounded-xl bg-ok px-5 py-3 text-sm font-semibold text-background disabled:opacity-50"
            >
              {busy ? "Seeding pool…" : "Seed Ref pool"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              disabled={busy}
              className="rounded-xl border border-line px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              Skip
            </button>
          </div>
        </section>
      ) : null}

      {step === "done" && seedTarget && poolId !== null ? (
        <section className="rounded-2xl border border-ok/40 bg-panel/90 p-6">
          <p className="font-mono text-xs tracking-[0.24em] text-ok">POOL LIVE</p>
          <h2 className="mt-2 text-2xl text-white">Pool #{poolId} is seeded</h2>
          <ul className="mt-5 space-y-2 font-mono text-sm text-muted">
            <li>
              Token:{" "}
              <a className="text-ok underline" href={contracts.explorerAccount(seedTarget.tokenId)}>
                {seedTarget.tokenId}
              </a>
            </li>
            <li>
              Pair: <span className="text-white">{seedTarget.symbol} / wNEAR</span>
            </li>
            <li>
              AMM:{" "}
              <a className="text-ok underline" href={contracts.explorerAccount(contracts.amm)}>
                {contracts.amm}
              </a>
            </li>
            <li>
              Pool id: <span className="text-white">{poolId}</span>
            </li>
          </ul>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              href={`/swap?token=${seedTarget.tokenId}&pool=${poolId}`}
              className="rounded-xl bg-ok px-5 py-3 text-sm font-semibold text-background"
            >
              Swap {seedTarget.symbol}
            </Link>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-line px-5 py-3 text-sm font-semibold text-white"
            >
              Launch another
            </button>
          </div>
        </section>
      ) : null}

      <LaunchedList
        accountId={wallet.signedAccountId}
        tokens={launched}
        busy={listBusy}
        error={listError}
        explorerAccount={contracts.explorerAccount}
        onSeed={startSeedFromList}
      />

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block font-mono text-xs tracking-wide text-muted uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

function LaunchedList({
  accountId,
  tokens,
  busy,
  error,
  explorerAccount,
  onSeed,
}: {
  accountId: string | null;
  tokens: LaunchedToken[];
  busy: boolean;
  error: string | null;
  explorerAccount: (accountId: string) => string;
  onSeed: (token: LaunchedToken) => void;
}) {
  return (
    <section className="rounded-2xl border border-line bg-panel/80 p-5 sm:p-6">
      <p className="font-mono text-xs tracking-[0.24em] text-ok">YOUR TOKENS</p>
      {!accountId ? (
        <p className="mt-3 text-sm text-muted">Connect to see tokens you launched.</p>
      ) : busy ? (
        <p className="mt-3 text-sm text-muted">Loading…</p>
      ) : error ? (
        <p className="mt-3 text-sm text-block">{error}</p>
      ) : tokens.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No factory tokens yet for {accountId}.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {tokens.map((token) => (
            <li
              key={token.tokenId}
              className="flex items-center gap-4 rounded-xl border border-line bg-background px-4 py-3"
            >
              <a
                href={explorerAccount(token.tokenId)}
                className="flex min-w-0 flex-1 items-center gap-4"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line">
                  {token.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={token.icon} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-mono text-[10px] text-muted">FT</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white">{token.name}</p>
                  <p className="truncate font-mono text-[11px] text-muted">{token.tokenId}</p>
                </div>
                <div className="hidden text-right font-mono text-[11px] text-muted sm:block">
                  <p className="text-white">{token.symbol}</p>
                  <p>{token.balance}</p>
                </div>
              </a>
              <Link
                href={`/swap?token=${token.tokenId}`}
                className="shrink-0 rounded-lg border border-line px-3 py-2 font-mono text-[11px] text-white uppercase hover:border-ok/40"
              >
                Swap
              </Link>
              <button
                type="button"
                onClick={() => onSeed(token)}
                className="shrink-0 rounded-lg border border-line px-3 py-2 font-mono text-[11px] text-white uppercase hover:border-ok/40"
              >
                Seed pool
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StepChip({
  n,
  label,
  active,
  done,
}: {
  n: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <li
      className={`rounded-xl border px-4 py-3 font-mono text-xs uppercase ${
        active
          ? "border-ok/40 bg-ok/10 text-ok"
          : done
            ? "border-line text-white"
            : "border-line text-muted"
      }`}
    >
      {n}. {label}
    </li>
  );
}
