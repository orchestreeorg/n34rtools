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

  const msg = JSON.stringify({
    force: 0,
    actions: [
      {
        pool_id: quote.poolId,
        token_in: quote.tokenIn,
        token_out: quote.tokenOut,
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

  const deposits = (await wallet.viewFunction({
    contractId: amm,
    method: "get_deposits",
    args: { account_id: user },
  })) as Record<string, string>;
  const outRaw = deposits?.[quote.tokenOut] ?? "0";
  if (BigInt(outRaw || "0") <= 0n) {
    throw new Error("Swap submitted but no output was deposited. Try a larger amount.");
  }

  await wallet.callFunction({
    contractId: amm,
    method: "withdraw",
    args: { token_id: quote.tokenOut, amount: outRaw, unregister: false },
    deposit: "1",
    gas: "50000000000000",
  });

  if (quote.tokenOut === wrap) {
    await wallet.callFunction({
      contractId: wrap,
      method: "near_withdraw",
      args: { amount: outRaw },
      deposit: "1",
      gas: "30000000000000",
    });
  }

  return { amountOut: asString(outRaw) };
}
