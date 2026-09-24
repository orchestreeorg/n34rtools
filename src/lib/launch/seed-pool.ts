import {
  CONTRACTS,
  LAUNCH_NETWORK,
  humanToTokenUnits,
  nearToYocto,
} from "./contracts";

export type WalletCaller = {
  signedAccountId: string;
  viewFunction: (params: {
    contractId: string;
    method: string;
    args?: Record<string, unknown>;
  }) => Promise<unknown>;
  callFunction: (params: {
    contractId: string;
    method: string;
    args?: Record<string, unknown>;
    gas?: string;
    deposit?: string;
  }) => Promise<unknown>;
};

export type SeedPoolInput = {
  tokenId: string;
  supply: string;
  liquidityNear: string;
  lpPercent: number;
};

export type SeedPoolResult = {
  poolId: number;
  tokenAmount: string;
  wrapAmount: string;
};

function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (value && typeof value === "object" && "result" in value) {
    return asNumber((value as { result: unknown }).result);
  }
  return Number(value);
}

function cleanAmount(value: string): string {
  return value.replace(/,/g, "").trim();
}

async function isRegistered(
  wallet: WalletCaller,
  contractId: string,
  accountId: string,
): Promise<boolean> {
  try {
    const balance = await wallet.viewFunction({
      contractId,
      method: "storage_balance_of",
      args: { account_id: accountId },
    });
    return balance !== null && balance !== undefined;
  } catch {
    return false;
  }
}

export function splitLiquidity(input: SeedPoolInput): {
  tokenAmount: string;
  wrapAmount: string;
} {
  const total = BigInt(humanToTokenUnits(cleanAmount(input.supply), 18));
  const percent = Math.min(95, Math.max(10, input.lpPercent));
  const tokenAmount = (total * BigInt(percent)) / 100n;
  if (tokenAmount <= 0n) throw new Error("LP token amount is too small.");
  const wrapAmount = nearToYocto(cleanAmount(input.liquidityNear));
  if (BigInt(wrapAmount) <= 0n) throw new Error("NEAR liquidity must be greater than 0.");
  return { tokenAmount: tokenAmount.toString(), wrapAmount };
}

export async function seedRefPool(
  wallet: WalletCaller,
  input: SeedPoolInput,
): Promise<SeedPoolResult> {
  const contracts = CONTRACTS[LAUNCH_NETWORK];
  const user = wallet.signedAccountId;
  const { tokenAmount, wrapAmount } = splitLiquidity(input);
  const { amm, wrap, poolFee } = contracts;

  if (!(await isRegistered(wallet, amm, user))) {
    await wallet.callFunction({
      contractId: amm,
      method: "storage_deposit",
      args: { account_id: user, registration_only: false },
      deposit: contracts.ammStorageYocto,
      gas: "30000000000000",
    });
  }

  const before = asNumber(
    await wallet.viewFunction({
      contractId: amm,
      method: "get_number_of_pools",
    }),
  );

  const poolIdRaw = await wallet.callFunction({
    contractId: amm,
    method: "add_simple_pool",
    args: { tokens: [input.tokenId, wrap], fee: poolFee },
    deposit: contracts.poolStorageYocto,
    gas: "100000000000000",
  });
  let poolId = asNumber(poolIdRaw);
  if (!Number.isFinite(poolId)) {
    const after = asNumber(
      await wallet.viewFunction({
        contractId: amm,
        method: "get_number_of_pools",
      }),
    );
    poolId = Number.isFinite(after) && after > 0 ? after - 1 : before;
  }
  if (!Number.isFinite(poolId)) {
    throw new Error("Pool was created but the pool id could not be read.");
  }

  try {
    await wallet.callFunction({
      contractId: amm,
      method: "register_tokens",
      args: { token_ids: [input.tokenId, wrap] },
      deposit: "1",
      gas: "30000000000000",
    });
  } catch {
    // Already registered on this inner account.
  }

  if (!(await isRegistered(wallet, wrap, user))) {
    await wallet.callFunction({
      contractId: wrap,
      method: "storage_deposit",
      args: { account_id: user, registration_only: false },
      deposit: contracts.ftStorageYocto,
      gas: "30000000000000",
    });
  }

  if (!(await isRegistered(wallet, wrap, amm))) {
    await wallet.callFunction({
      contractId: wrap,
      method: "storage_deposit",
      args: { account_id: amm, registration_only: false },
      deposit: contracts.ftStorageYocto,
      gas: "30000000000000",
    });
  }

  if (!(await isRegistered(wallet, input.tokenId, amm))) {
    await wallet.callFunction({
      contractId: input.tokenId,
      method: "storage_deposit",
      args: { account_id: amm, registration_only: false },
      deposit: contracts.ftStorageYocto,
      gas: "30000000000000",
    });
  }

  await wallet.callFunction({
    contractId: wrap,
    method: "near_deposit",
    args: {},
    deposit: wrapAmount,
    gas: "30000000000000",
  });

  await wallet.callFunction({
    contractId: wrap,
    method: "ft_transfer_call",
    args: { receiver_id: amm, amount: wrapAmount, msg: "" },
    deposit: "1",
    gas: "150000000000000",
  });

  await wallet.callFunction({
    contractId: input.tokenId,
    method: "ft_transfer_call",
    args: { receiver_id: amm, amount: tokenAmount, msg: "" },
    deposit: "1",
    gas: "150000000000000",
  });

  await wallet.callFunction({
    contractId: amm,
    method: "add_liquidity",
    args: { pool_id: poolId, amounts: [tokenAmount, wrapAmount] },
    deposit: contracts.lpStorageYocto,
    gas: "150000000000000",
  });

  return { poolId, tokenAmount, wrapAmount };
}

export const seedJumpPool = seedRefPool;
