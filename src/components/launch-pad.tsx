"use client";

import {
  CONTRACTS,
  LAUNCH_NETWORK,
  predictedTokenId,
  tokenIcon,
} from "@/lib/launch/contracts";
import { buildCreateTokenPlan } from "@/lib/launch/create-token";
import { fileToTokenIcon } from "@/lib/launch/icon";
import { useNearWallet } from "near-connect-hooks";
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";

type Step = "form" | "done";

type CreatedToken = {
  tokenId: string;
  name: string;
  symbol: string;
  supply: string;
  ownerId: string;
  icon: string;
};

export function LaunchPad() {
  const wallet = useNearWallet();
  const contracts = CONTRACTS[LAUNCH_NETWORK];

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [supply, setSupply] = useState("1000000000");
  const [icon, setIcon] = useState<string | null>(null);
  const [iconBusy, setIconBusy] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedToken | null>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);

  const previewId = symbol.trim() ? predictedTokenId(symbol.trim().toLowerCase()) : "";
  const previewIcon = useMemo(
    () => icon ?? (symbol.trim() ? tokenIcon(symbol.trim().toLowerCase()) : null),
    [icon, symbol],
  );

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

      setCreated({
        tokenId: plan.tokenId,
        name: name.trim(),
        symbol: symbol.trim().toLowerCase(),
        supply: supply.trim(),
        ownerId: wallet.signedAccountId,
        icon: plan.args.args.metadata.icon,
      });
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Token create failed");
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
    setCreated(null);
    setError(null);
    setName("");
    setSymbol("");
    setSupply("1000000000");
    setIcon(null);
    if (iconInputRef.current) iconInputRef.current.value = "";
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
          Create a fixed-supply NEP-141 meme token on NEAR testnet. For fun, you
          pay, we never hold keys. The whole supply is minted to your wallet.
        </p>
      </header>

      <ol className="grid gap-3 sm:grid-cols-2">
        <StepChip n={1} label="Create token" active={step === "form"} done={step === "done"} />
        <StepChip n={2} label="Token created" active={step === "done"} done={false} />
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
            gas. Testnet only — the mainnet factory is not deployed.
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

      {step === "done" && created ? (
        <section className="rounded-2xl border border-ok/40 bg-panel/90 p-6">
          <p className="font-mono text-xs tracking-[0.24em] text-ok">TOKEN CREATED</p>
          <div className="mt-3 flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={created.icon}
              alt=""
              className="h-16 w-16 rounded-2xl border border-line bg-background object-cover"
            />
            <h2 className="text-2xl text-white">{created.name}</h2>
          </div>
          <ul className="mt-5 space-y-2 font-mono text-sm text-muted">
            <li>
              Token:{" "}
              <a className="text-ok underline" href={contracts.explorerAccount(created.tokenId)}>
                {created.tokenId}
              </a>
            </li>
            <li>
              Symbol: <span className="text-white">{created.symbol}</span>
            </li>
            <li>
              Supply: <span className="text-white">{created.supply}</span>{" "}
              <span className="text-muted">(18 decimals)</span>
            </li>
            <li>
              Owner:{" "}
              <a className="text-ok underline" href={contracts.explorerAccount(created.ownerId)}>
                {created.ownerId}
              </a>
            </li>
            <li>
              Factory:{" "}
              <a
                className="text-ok underline"
                href={contracts.explorerAccount(contracts.factory ?? "")}
              >
                {contracts.factory}
              </a>
            </li>
          </ul>
          <button
            type="button"
            onClick={resetForm}
            className="mt-5 rounded-xl border border-line px-5 py-3 text-sm font-semibold text-white"
          >
            Create another
          </button>
        </section>
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
