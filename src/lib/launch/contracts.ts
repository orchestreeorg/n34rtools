import type { NetworkId } from "@/lib/near/types";

/**
 * Spike notes (2026-09-23):
 * - Official factory `token.primitives.near` does not exist on mainnet.
 *   `token.primitives.testnet` does. Launch MVP therefore runs on testnet.
 * - Pool seed uses Ref Finance `ref-finance-101.testnet` (SDK address) with
 *   `wrap.testnet`. Same ABI as mainnet `v2.ref-finance.near`.
 * - testnet.ref.finance / its indexer often hang. We create pools on-chain and
 *   link NearBlocks, not the Ref UI.
 * - Jump AMM (`jump_amm.testnet`) is the same Ref-style ABI but has no reliable
 *   mainnet twin.
 */

export type LaunchContracts = {
  factory: string | null;
  tokenSuffix: string;
  amm: string;
  wrap: string;
  poolFee: number;
  factoryDepositYocto: string;
  ammStorageYocto: string;
  poolStorageYocto: string;
  ftStorageYocto: string;
  lpStorageYocto: string;
  explorerAccount: (accountId: string) => string;
  explorerTx: (hash: string) => string;
  jumpSwap: string;
  refPool: (poolId: number) => string;
};

export const LAUNCH_NETWORK: NetworkId = "testnet";

export const CONTRACTS: Record<NetworkId, LaunchContracts> = {
  testnet: {
    factory: "token.primitives.testnet",
    tokenSuffix: "token.primitives.testnet",
    amm: "ref-finance-101.testnet",
    wrap: "wrap.testnet",
    poolFee: 30,
    factoryDepositYocto: "2234830000000000000000000",
    ammStorageYocto: "250000000000000000000000",
    poolStorageYocto: "100000000000000000000000",
    ftStorageYocto: "1250000000000000000000",
    lpStorageYocto: "10000000000000000000000",
    explorerAccount: (id) => `https://testnet.nearblocks.io/address/${id}`,
    explorerTx: (hash) => `https://testnet.nearblocks.io/txns/${hash}`,
    jumpSwap: "https://www.jumpdefi.xyz/",
    refPool: (poolId) => `https://testnet.nearblocks.io/address/ref-finance-101.testnet?tab=txns`,
  },
  mainnet: {
    factory: null,
    tokenSuffix: "token.primitives.near",
    amm: "v2.ref-finance.near",
    wrap: "wrap.near",
    poolFee: 30,
    factoryDepositYocto: "2234830000000000000000000",
    ammStorageYocto: "250000000000000000000000",
    poolStorageYocto: "100000000000000000000000",
    ftStorageYocto: "1250000000000000000000",
    lpStorageYocto: "10000000000000000000000",
    explorerAccount: (id) => `https://nearblocks.io/address/${id}`,
    explorerTx: (hash) => `https://nearblocks.io/txns/${hash}`,
    jumpSwap: "https://www.jumpdefi.xyz/",
    refPool: (poolId) => `https://app.ref.finance/pool/${poolId}`,
  },
};

export const SYMBOL_REGEX = /^[a-z][a-z0-9]{1,11}$/;

export function predictedTokenId(symbol: string, network: NetworkId = LAUNCH_NETWORK): string {
  return `${symbol.toLowerCase()}.${CONTRACTS[network].tokenSuffix}`;
}

export function tokenIcon(symbol: string): string {
  const label = symbol.slice(0, 4).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#00EC97"/><text x="32" y="40" text-anchor="middle" font-family="monospace" font-size="16" fill="#07110c">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function humanToTokenUnits(amount: string, decimals = 18): string {
  const [whole = "0", frac = ""] = amount.trim().split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const raw = `${whole.replace(/^0+(?=\d)/, "") || "0"}${fracPadded}`.replace(/^0+(?=\d)/, "") || "0";
  return raw;
}

export function tokenUnitsToHuman(raw: string, decimals = 18): string {
  const value = BigInt(raw || "0");
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const frac = value % base;
  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (frac === 0n) return wholeStr;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${wholeStr}.${fracStr}`;
}

export function nearToYocto(amount: string): string {
  return humanToTokenUnits(amount, 24);
}

export function estimateLaunchNear(liquidityNear: string): string {
  const liq = Number(liquidityNear);
  if (!Number.isFinite(liq) || liq <= 0) return "—";
  const fixed = 2.23483 + 0.25 + 0.1 + 0.0125 + 0.0125 + 0.01;
  return (fixed + liq).toFixed(3);
}

export function estimatePoolNear(liquidityNear: string): string {
  const liq = Number(liquidityNear);
  if (!Number.isFinite(liq) || liq <= 0) return "—";
  const fixed = 0.25 + 0.1 + 0.0125 + 0.0125 + 0.01;
  return (fixed + liq).toFixed(3);
}
