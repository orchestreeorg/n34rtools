"use client";

import { kindLabel } from "@/lib/near/account";
import type { InspectReport, NetworkId } from "@/lib/near/types";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";

const EXAMPLES: { label: string; accountId: string; network: NetworkId; token?: string }[] =
  [
    { label: "root.near", accountId: "root.near", network: "mainnet" },
    { label: "missing named", accountId: "thisaccountdoesnotexist123.near", network: "mainnet" },
    { label: "implicit hex", accountId: "a".repeat(64), network: "mainnet" },
    {
      label: "USDT check",
      accountId: "root.near",
      network: "mainnet",
      token: "usdt.tether-token.near",
    },
  ];

type StatusTone = {
  label: string;
  border: string;
  text: string;
  bg: string;
};

function tone(status: InspectReport["status"]): StatusTone {
  if (status === "ok") {
    return {
      label: "OK",
      border: "border-ok/40",
      text: "text-ok",
      bg: "bg-ok/10",
    };
  }
  if (status === "confirm") {
    return {
      label: "WARN",
      border: "border-warn/40",
      text: "text-warn",
      bg: "bg-warn/10",
    };
  }
  return {
    label: "BLOCK",
    border: "border-block/40",
    text: "text-block",
    bg: "bg-block/10",
  };
}

export function SendGuard() {
  const [accountId, setAccountId] = useState("root.near");
  const [tokenContractId, setTokenContractId] = useState("");
  const [network, setNetwork] = useState<NetworkId>("mainnet");
  const [report, setReport] = useState<InspectReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"recipient" | "chains">("recipient");

  const canInspect = accountId.trim().length >= 2;

  async function runInspect(next = { accountId, network, tokenContractId }) {
    if (!next.accountId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: next.accountId,
          network: next.network,
          tokenContractId: next.tokenContractId || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Inspect failed");
      }
      setReport(payload as InspectReport);
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "Inspect failed");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void runInspect();
  }

  useEffect(() => {
    void runInspect();
    // First paint only — later checks are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const facts = useMemo(() => {
    if (!report) return [];
    return [
      ["Account", report.accountId],
      ["Type", report.kind ? kindLabel(report.kind) : "Unknown"],
      ["Network", report.network],
      ["Exists", report.exists ? "Yes" : "No"],
      ["Contract", report.isContract ? "Yes" : "No"],
      ["Available", report.balance ? `${report.balance.availableNear} Ⓝ` : "—"],
      ["Locked / staked", report.balance ? `${report.balance.lockedNear} Ⓝ` : "—"],
      ["Storage locked", report.balance ? `${report.balance.storageNear} Ⓝ` : "—"],
      [
        "Storage used",
        report.storageUsageBytes !== null
          ? `${report.storageUsageBytes.toLocaleString()} bytes`
          : "—",
      ],
      [
        "Access keys",
        report.keys
          ? `${report.keys.total} (${report.keys.fullAccess} full, ${report.keys.functionCall} function-call)`
          : "—",
      ],
    ];
  }, [report]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-10 sm:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <p className="font-mono text-xs tracking-[0.28em] text-ok uppercase">
            n34r.tools
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Send Guard
          </h1>
          <p className="max-w-xl text-muted text-base leading-7">
            Check a recipient before you transfer NEAR, FTs, or NFTs. Catch
            typos, missing named accounts, unfunded implicit keys, and wallets
            that still need a storage deposit.
          </p>
        </div>
        <div className="font-mono text-xs text-muted">
          Read-only · FastNear RPC · no wallet
        </div>
      </header>

      <div className="flex gap-2 border-b border-line">
        <TabButton
          active={activeTab === "recipient"}
          onClick={() => setActiveTab("recipient")}
        >
          Recipient check
        </TabButton>
        <TabButton
          active={activeTab === "chains"}
          onClick={() => setActiveTab("chains")}
        >
          Cross-chain addresses
        </TabButton>
      </div>

      {activeTab === "chains" ? (
        <section className="rounded-2xl border border-line bg-panel/80 p-8">
          <p className="font-mono text-xs tracking-[0.2em] text-warn uppercase">
            Next up
          </p>
          <h2 className="mt-3 text-2xl text-white">Chain signature preview</h2>
          <p className="mt-3 max-w-2xl text-muted leading-7">
            This tab will derive the Bitcoin, Ethereum, and Solana addresses
            controlled by a NEAR account via chain signatures. No MPC signing
            — preview only.
          </p>
        </section>
      ) : (
        <>
          <form
            onSubmit={onSubmit}
            className="rounded-2xl border border-line bg-panel/80 p-5 sm:p-6"
          >
            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <label className="block">
                <span className="mb-2 block font-mono text-xs tracking-wide text-muted uppercase">
                  Recipient account
                </span>
                <input
                  value={accountId}
                  onChange={(event) => setAccountId(event.target.value)}
                  spellCheck={false}
                  autoCapitalize="none"
                  placeholder="alice.near"
                  className="w-full rounded-xl border border-line bg-background px-4 py-3 font-mono text-sm text-white outline-none ring-ok/40 placeholder:text-muted/60 focus:ring-2"
                />
              </label>
              <fieldset className="flex items-end">
                <div className="flex w-full rounded-xl border border-line p-1">
                  {(["mainnet", "testnet"] as NetworkId[]).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setNetwork(id)}
                      className={`flex-1 rounded-lg px-4 py-2.5 font-mono text-xs uppercase ${
                        network === id
                          ? "bg-ok text-background"
                          : "text-muted hover:text-white"
                      }`}
                    >
                      {id}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

            <label className="mt-4 block">
              <span className="mb-2 block font-mono text-xs tracking-wide text-muted uppercase">
                Optional FT contract
              </span>
              <input
                value={tokenContractId}
                onChange={(event) => setTokenContractId(event.target.value)}
                spellCheck={false}
                autoCapitalize="none"
                placeholder="usdt.tether-token.near"
                className="w-full rounded-xl border border-line bg-background px-4 py-3 font-mono text-sm text-white outline-none ring-ok/40 placeholder:text-muted/60 focus:ring-2"
              />
            </label>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={!canInspect || loading}
                className="rounded-xl bg-ok px-5 py-3 text-sm font-semibold text-background disabled:opacity-50"
              >
                {loading ? "Checking…" : "Inspect recipient"}
              </button>
              <p className="font-mono text-xs text-muted">
                Always show the full account ID before sending.
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example.label}
                  type="button"
                  onClick={() => {
                    setAccountId(example.accountId);
                    setNetwork(example.network);
                    setTokenContractId(example.token ?? "");
                    void runInspect({
                      accountId: example.accountId,
                      network: example.network,
                      tokenContractId: example.token ?? "",
                    });
                  }}
                  className="rounded-full border border-line px-3 py-1.5 font-mono text-xs text-muted hover:border-ok/50 hover:text-white"
                >
                  {example.label}
                </button>
              ))}
            </div>
          </form>

          {error ? (
            <p className="rounded-xl border border-block/40 bg-block/10 px-4 py-3 text-sm text-block">
              {error}
            </p>
          ) : null}

          {report ? <ReportCard report={report} facts={facts} /> : null}
        </>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-4 py-3 text-sm ${
        active
          ? "border-ok text-white"
          : "border-transparent text-muted hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function ReportCard({
  report,
  facts,
}: {
  report: InspectReport;
  facts: string[][];
}) {
  const colors = tone(report.status);

  return (
    <section className={`rounded-2xl border ${colors.border} bg-panel/90 overflow-hidden`}>
      <div className={`flex flex-col gap-3 border-b border-line px-6 py-5 ${colors.bg} sm:flex-row sm:items-center sm:justify-between`}>
        <div>
          <p className={`font-mono text-xs tracking-[0.24em] ${colors.text}`}>
            {colors.label}
          </p>
          <h2 className="mt-2 text-2xl text-white">{report.title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{report.detail}</p>
        </div>
        <code className="break-all font-mono text-sm text-white">{report.accountId}</code>
      </div>

      <dl className="grid gap-px bg-line sm:grid-cols-2">
        {facts.map(([label, value]) => (
          <div key={label} className="bg-panel px-6 py-4">
            <dt className="font-mono text-[11px] tracking-wide text-muted uppercase">
              {label}
            </dt>
            <dd className="mt-1 break-all font-mono text-sm text-white">{value}</dd>
          </div>
        ))}
      </dl>

      {report.token ? (
        <div className="border-t border-line px-6 py-5">
          <p className="font-mono text-[11px] tracking-wide text-muted uppercase">
            Token registration
          </p>
          <p className="mt-2 font-mono text-sm text-white">
            {report.token.contractId}:{" "}
            {report.token.error
              ? `lookup failed (${report.token.error})`
              : report.token.registered
                ? "registered"
                : "not registered — storage_deposit required"}
          </p>
        </div>
      ) : null}
    </section>
  );
}
