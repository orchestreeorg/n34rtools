import { isValidAccountIdFormat } from "@/lib/near/account";
import type { NetworkId } from "@/lib/near/types";
import { viewFunction } from "@/lib/rpc/near";
import { CONTRACTS, LAUNCH_NETWORK, tokenUnitsToHuman } from "./contracts";

const FASTNEAR_API_DEFAULTS: Record<NetworkId, string> = {
  mainnet: "https://api.fastnear.com",
  testnet: "https://test.api.fastnear.com",
};

function fastNearApiUrl(network: NetworkId): string {
  const fromEnv =
    network === "testnet"
      ? process.env.FASTNEAR_API_TESTNET
      : process.env.FASTNEAR_API_MAINNET;
  const trimmed = fromEnv?.trim();
  if (trimmed && /^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/$/, "");
  }
  return FASTNEAR_API_DEFAULTS[network];
}

type FastNearFt = {
  contract_id?: string;
  balance?: string;
};

type FtMetadata = {
  name?: string;
  symbol?: string;
  icon?: string | null;
  decimals?: number;
};

export type LaunchedToken = {
  tokenId: string;
  name: string;
  symbol: string;
  icon: string | null;
  decimals: number;
  supply: string;
  balance: string;
};

export async function listLaunchedTokens(accountId: string): Promise<LaunchedToken[]> {
  const owner = accountId.trim().toLowerCase();
  if (!isValidAccountIdFormat(owner)) {
    throw new Error("Invalid account id.");
  }

  const suffix = `.${CONTRACTS[LAUNCH_NETWORK].tokenSuffix}`;
  const url = `${fastNearApiUrl(LAUNCH_NETWORK)}/v1/account/${owner}/ft`;
  const response = await fetch(url, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`FastNear ${response.status}`);
  }

  const payload = (await response.json()) as { tokens?: FastNearFt[] };
  const holdings = (payload.tokens ?? []).filter(
    (token): token is FastNearFt & { contract_id: string; balance: string } =>
      typeof token.contract_id === "string" &&
      token.contract_id.endsWith(suffix) &&
      typeof token.balance === "string",
  );

  const tokens = await Promise.all(holdings.map((holding) => enrichToken(holding)));
  return tokens.filter((token): token is LaunchedToken => token !== null);
}

async function enrichToken(
  holding: { contract_id: string; balance: string },
): Promise<LaunchedToken | null> {
  try {
    const [metadata, supplyRaw] = await Promise.all([
      viewFunction<FtMetadata>(LAUNCH_NETWORK, holding.contract_id, "ft_metadata"),
      viewFunction<string>(LAUNCH_NETWORK, holding.contract_id, "ft_total_supply"),
    ]);
    const decimals = Number.isInteger(metadata.decimals) ? Number(metadata.decimals) : 18;
    return {
      tokenId: holding.contract_id,
      name: metadata.name?.trim() || holding.contract_id,
      symbol: metadata.symbol?.trim() || holding.contract_id.split(".")[0] || "token",
      icon: metadata.icon ?? null,
      decimals,
      supply: tokenUnitsToHuman(supplyRaw, decimals),
      balance: tokenUnitsToHuman(holding.balance, decimals),
    };
  } catch {
    return null;
  }
}
