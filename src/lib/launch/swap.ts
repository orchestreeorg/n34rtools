import { CONTRACTS, LAUNCH_NETWORK } from "./contracts";
import type { SwapQuote } from "./pool";
import type { WalletCaller } from "./seed-pool";

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

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object" && "result" in value) {
    return asString((value as { result: unknown }).result);
  }
  return "0";
}

function asBigInt(value: unknown): bigint {
  try {
    return BigInt(asString(value) || "0");
  } catch {
    return 0n;
  }
}

function depositAmount(deposits: unknown, tokenId: string): bigint {
  if (!deposits) return 0n;
  if (Array.isArray(deposits)) {
    for (const row of deposits) {
      if (Array.isArray(row) && row[0] === tokenId) return asBigInt(row[1]);
    }
    return 0n;
  }
  if (typeof deposits === "object") {
    const rec = deposits as Record<string, unknown>;
    if ("result" in rec) return depositAmount(rec.result, tokenId);
    return asBigInt(rec[tokenId]);
  }
  return 0n;
}

async function ftBalance(
  wallet: WalletCaller,
  tokenId: string,
  accountId: string,
): Promise<bigint> {
  try {
    return asBigInt(
      await wallet.viewFunction({
        contractId: tokenId,
        method: "ft_balance_of",
        args: { account_id: accountId },
      }),
    );
  } catch {
    return 0n;
  }
}

async function ammDeposit(
  wallet: WalletCaller,
  amm: string,
  accountId: string,
  tokenId: string,
): Promise<bigint> {
  try {
    return depositAmount(
      await wallet.viewFunction({
        contractId: amm,
        method: "get_deposits",
        args: { account_id: accountId },
      }),
      tokenId,
    );
  } catch {
    return 0n;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function executeRefSwap(
  wallet: WalletCaller,
  quote: SwapQuote,
): Promise<{ amountOut: string }> {
  const contracts = CONTRACTS[LAUNCH_NETWORK];
  const user = wallet.signedAccountId;
  const { amm, wrap } = contracts;

  if (!(await isRegistered(wallet, amm, user))) {
    await wallet.callFunction({
      contractId: amm,
      method: "storage_deposit",
      args: { account_id: user, registration_only: false },
      deposit: contracts.ammStorageYocto,
      gas: "30000000000000",
    });
  }

  try {
    await wallet.callFunction({
      contractId: amm,
      method: "register_tokens",
      args: { token_ids: [quote.tokenIn, quote.tokenOut] },
      deposit: "1",
      gas: "30000000000000",
    });
  } catch {
    // Already registered.
  }

  if (!(await isRegistered(wallet, quote.tokenOut, user))) {
    await wallet.callFunction({
      contractId: quote.tokenOut,
      method: "storage_deposit",
      args: { account_id: user, registration_only: false },
      deposit: contracts.ftStorageYocto,
      gas: "30000000000000",
    });
  }

  if (quote.sellingNear) {
    if (!(await isRegistered(wallet, wrap, user))) {
      await wallet.callFunction({
        contractId: wrap,
        method: "storage_deposit",
        args: { account_id: user, registration_only: false },
        deposit: contracts.ftStorageYocto,
        gas: "30000000000000",
      });
    }
    await wallet.callFunction({
      contractId: wrap,
      method: "near_deposit",
      args: {},
      deposit: quote.amountInRaw,
      gas: "30000000000000",
    });
  }

  const outBefore = await ftBalance(wallet, quote.tokenOut, user);
  const wrapBefore = quote.tokenOut === wrap ? outBefore : 0n;

  const msg = JSON.stringify({
    force: 0,
    skip_unwrap_near: false,
    actions: [
      {
        pool_id: quote.poolId,
        token_in: quote.tokenIn,
        token_out: quote.tokenOut,
        amount_in: quote.amountInRaw,
        min_amount_out: quote.minAmountOutRaw,
      },
    ],
  });

  await wallet.callFunction({
    contractId: quote.tokenIn,
    method: "ft_transfer_call",
    args: { receiver_id: amm, amount: quote.amountInRaw, msg },
    deposit: "1",
    gas: "200000000000000",
  });

  // Current Ref testnet sends output to the wallet in the same tx. Older
  // builds leave it in AMM deposits — withdraw only if something is there.
  const parked = await ammDeposit(wallet, amm, user, quote.tokenOut);
  if (parked > 0n) {
    await wallet.callFunction({
      contractId: amm,
      method: "withdraw",
      args: { token_id: quote.tokenOut, amount: parked.toString(), unregister: false },
      deposit: "1",
      gas: "50000000000000",
    });
    if (quote.tokenOut === wrap) {
      await wallet.callFunction({
        contractId: wrap,
        method: "near_withdraw",
        args: { amount: parked.toString() },
        deposit: "1",
        gas: "30000000000000",
      });
    }
  } else if (quote.tokenOut === wrap) {
    const extraWrap = (await ftBalance(wallet, wrap, user)) - wrapBefore;
    if (extraWrap > 0n) {
      await wallet.callFunction({
        contractId: wrap,
        method: "near_withdraw",
        args: { amount: extraWrap.toString() },
        deposit: "1",
        gas: "30000000000000",
      });
    }
  } else {
    let outAfter = await ftBalance(wallet, quote.tokenOut, user);
    if (outAfter <= outBefore) {
      await sleep(600);
      outAfter = await ftBalance(wallet, quote.tokenOut, user);
    }
    if (outAfter <= outBefore) {
      throw new Error(
        "Swap submitted but the output token did not arrive. Check the transaction on NearBlocks.",
      );
    }
  }

  return { amountOut: quote.amountOut };
}
