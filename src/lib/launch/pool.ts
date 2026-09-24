import { viewFunction } from "@/lib/rpc/near";
import {
  CONTRACTS,
  LAUNCH_NETWORK,
  humanToTokenUnits,
  tokenUnitsToHuman,
} from "./contracts";

export type RefPool = {
  poolId: number;
  tokenId: string;
  wrapId: string;
  tokenRaw: string;
  wrapRaw: string;
  fee: number;
};

export type PoolView = {
  poolId: number;
  tokenId: string;
  name: string;
  symbol: string;
  icon: string | null;
  decimals: number;
  tokenReserve: string;
  nearReserve: string;
  priceNearPerToken: string;
  priceTokenPerNear: string;
  fee: number;
};

export type SwapQuote = {
  poolId: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountInRaw: string;
  amountOut: string;
  amountOutRaw: string;
  minAmountOutRaw: string;
  sellingNear: boolean;
};

type RawPool = {
  token_account_ids?: string[];
  amounts?: string[];
  total_fee?: number;
};

type FtMetadata = {
  name?: string;
  symbol?: string;
  icon?: string | null;
  decimals?: number;
};

const SEARCH_WINDOW = 250;

function contracts() {
  return CONTRACTS[LAUNCH_NETWORK];
}

function matchesPair(pool: RawPool, tokenId: string, wrapId: string): boolean {
  const ids = pool.token_account_ids ?? [];
  return ids.includes(tokenId) && ids.includes(wrapId) && ids.length === 2;
}

function toRefPool(pool: RawPool, poolId: number, tokenId: string, wrapId: string): RefPool {
  const ids = pool.token_account_ids ?? [];
  const amounts = pool.amounts ?? ["0", "0"];
  const tokenIndex = ids.indexOf(tokenId);
  const wrapIndex = ids.indexOf(wrapId);
  return {
    poolId,
    tokenId,
    wrapId,
    tokenRaw: amounts[tokenIndex] ?? "0",
    wrapRaw: amounts[wrapIndex] ?? "0",
    fee: pool.total_fee ?? 30,
  };
}

function formatRatio(numer: bigint, denom: bigint, digits = 10): string {
  if (denom === 0n) return "—";
  const scale = 10n ** BigInt(digits);
  const scaled = (numer * scale) / denom;
  const whole = scaled / scale;
  const frac = scaled % scale;
  const fracStr = frac.toString().padStart(digits, "0").replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}

export async function getRefPool(poolId: number): Promise<RawPool> {
  return viewFunction<RawPool>(LAUNCH_NETWORK, contracts().amm, "get_pool", {
    pool_id: poolId,
  });
}

export async function findTokenNearPool(
  tokenId: string,
  poolIdHint?: number,
): Promise<RefPool | null> {
  const { amm, wrap } = contracts();
  const token = tokenId.trim().toLowerCase();

  if (poolIdHint !== undefined && Number.isFinite(poolIdHint)) {
    try {
      const pool = await getRefPool(poolIdHint);
      if (matchesPair(pool, token, wrap)) {
        return toRefPool(pool, poolIdHint, token, wrap);
      }
    } catch {
      // Fall through to a recent-pool scan.
    }
  }

  const count = Number(
    await viewFunction<number | string>(LAUNCH_NETWORK, amm, "get_number_of_pools"),
  );
  if (!Number.isFinite(count) || count <= 0) return null;

  const start = Math.max(0, count - SEARCH_WINDOW);
  for (let end = count; end > start; ) {
    const from = Math.max(start, end - 50);
    const pools = await viewFunction<RawPool[]>(LAUNCH_NETWORK, amm, "get_pools", {
      from_index: from,
      limit: end - from,
    });
    for (let i = pools.length - 1; i >= 0; i -= 1) {
      if (matchesPair(pools[i], token, wrap)) {
        return toRefPool(pools[i], from + i, token, wrap);
      }
    }
    end = from;
  }

  return null;
}

export async function getPoolView(
  tokenId?: string,
  poolId?: number,
): Promise<PoolView | null> {
  const { wrap } = contracts();
  let token = tokenId?.trim().toLowerCase();

  if (!token && poolId !== undefined) {
    const raw = await getRefPool(poolId);
    token = raw.token_account_ids?.find((id) => id !== wrap);
  }
  if (!token) return null;

  const pool = await findTokenNearPool(token, poolId);
  if (!pool) return null;

  const metadata = await viewFunction<FtMetadata>(
    LAUNCH_NETWORK,
    pool.tokenId,
    "ft_metadata",
  );
  const decimals = Number.isInteger(metadata.decimals) ? Number(metadata.decimals) : 18;
  const tokenReserveRaw = BigInt(pool.tokenRaw || "0");
  const wrapReserveRaw = BigInt(pool.wrapRaw || "0");

  return {
    poolId: pool.poolId,
    tokenId: pool.tokenId,
    name: metadata.name?.trim() || pool.tokenId,
    symbol: metadata.symbol?.trim() || pool.tokenId.split(".")[0] || "token",
    icon: metadata.icon ?? null,
    decimals,
    tokenReserve: tokenUnitsToHuman(pool.tokenRaw, decimals),
    nearReserve: tokenUnitsToHuman(pool.wrapRaw, 24),
    priceNearPerToken: formatRatio(
      wrapReserveRaw * 10n ** BigInt(decimals),
      tokenReserveRaw * 10n ** 24n,
    ),
    priceTokenPerNear: formatRatio(
      tokenReserveRaw * 10n ** 24n,
      wrapReserveRaw * 10n ** BigInt(decimals),
    ),
    fee: pool.fee,
  };
}

export async function quoteSwap(input: {
  tokenId: string;
  poolId?: number;
  amount: string;
  sellingNear: boolean;
}): Promise<SwapQuote> {
  const { amm, wrap } = contracts();
  const pool = await findTokenNearPool(input.tokenId, input.poolId);
  if (!pool) throw new Error("No TOKEN / wNEAR pool found.");

  const metadata = await viewFunction<FtMetadata>(LAUNCH_NETWORK, pool.tokenId, "ft_metadata");
  const decimals = Number.isInteger(metadata.decimals) ? Number(metadata.decimals) : 18;
  const amount = input.amount.replace(/,/g, "").trim();
  if (!amount || Number(amount) <= 0) throw new Error("Enter an amount.");

  const tokenIn = input.sellingNear ? wrap : pool.tokenId;
  const tokenOut = input.sellingNear ? pool.tokenId : wrap;
  const amountInRaw = humanToTokenUnits(amount, input.sellingNear ? 24 : decimals);
  const amountOutRaw = String(
    await viewFunction<string>(LAUNCH_NETWORK, amm, "get_return", {
      pool_id: pool.poolId,
      token_in: tokenIn,
      amount_in: amountInRaw,
      token_out: tokenOut,
    }),
  );
  const minAmountOutRaw = ((BigInt(amountOutRaw) * 99n) / 100n).toString();

  return {
    poolId: pool.poolId,
    tokenIn,
    tokenOut,
    amountIn: amount,
    amountInRaw,
    amountOut: tokenUnitsToHuman(amountOutRaw, input.sellingNear ? decimals : 24),
    amountOutRaw,
    minAmountOutRaw: BigInt(minAmountOutRaw) > 0n ? minAmountOutRaw : "1",
    sellingNear: input.sellingNear,
  };
}
