import type { NetworkId } from "@/lib/near/types";

const RPC_DEFAULTS: Record<NetworkId, string> = {
  mainnet: "https://free.rpc.fastnear.com",
  testnet: "https://test.rpc.fastnear.com",
};

function rpcUrl(network: NetworkId, fromEnv: string | undefined): string {
  const trimmed = fromEnv?.trim();
  if (trimmed && /^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/$/, "");
  }
  return RPC_DEFAULTS[network];
}

export const RPC_URLS: Record<NetworkId, string> = {
  mainnet: rpcUrl("mainnet", process.env.NEAR_RPC_MAINNET),
  testnet: rpcUrl("testnet", process.env.NEAR_RPC_TESTNET),
};

type RpcError = {
  name?: string;
  cause?: { name?: string; info?: { error_message?: string } };
  message?: string;
  data?: unknown;
};

type RpcResponse<T> = {
  result?: T;
  error?: RpcError;
};

export type NearAccountView = {
  amount: string;
  locked: string;
  code_hash: string;
  storage_usage: number;
};

export type NearAccessKey = {
  public_key: string;
  access_key: {
    nonce: number;
    permission: "FullAccess" | { FunctionCall: unknown };
  };
};

export type ProtocolConfig = {
  runtime_config?: {
    storage_amount_per_byte?: string;
  };
};

async function rpcCall<T>(
  network: NetworkId,
  method: string,
  params: unknown,
): Promise<T> {
  const response = await fetch(RPC_URLS[network], {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "send-guard",
      method,
      params,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`NEAR RPC ${response.status} from ${RPC_URLS[network]}`);
  }

  const payload = (await response.json()) as RpcResponse<T>;
  if (payload.error) {
    const err = new Error(payload.error.message ?? "NEAR RPC error") as Error & {
      rpc: RpcError;
    };
    err.rpc = payload.error;
    throw err;
  }

  if (payload.result === undefined) {
    throw new Error("NEAR RPC returned an empty result");
  }

  return payload.result;
}

function isUnknownAccount(error: unknown): boolean {
  const rpc = (error as { rpc?: RpcError } | undefined)?.rpc;
  const haystack = JSON.stringify(rpc ?? error);
  return /does not exist|unknown account|UNKNOWN_ACCOUNT|UnknownAccount/i.test(
    haystack,
  );
}

export async function viewAccount(
  network: NetworkId,
  accountId: string,
): Promise<NearAccountView | null> {
  try {
    const result = await rpcCall<{
      amount: string;
      locked: string;
      code_hash: string;
      storage_usage: number;
    }>(network, "query", {
      request_type: "view_account",
      finality: "final",
      account_id: accountId,
    });
    return result;
  } catch (error) {
    if (isUnknownAccount(error)) return null;
    throw error;
  }
}

export async function viewAccessKeyList(
  network: NetworkId,
  accountId: string,
): Promise<NearAccessKey[]> {
  const result = await rpcCall<{ keys: NearAccessKey[] }>(network, "query", {
    request_type: "view_access_key_list",
    finality: "final",
    account_id: accountId,
  });
  return result.keys ?? [];
}

export async function viewProtocolConfig(
  network: NetworkId,
): Promise<ProtocolConfig | null> {
  try {
    return await rpcCall<ProtocolConfig>(network, "EXPERIMENTAL_protocol_config", {
      finality: "final",
    });
  } catch {
    return null;
  }
}

export async function viewFunction<T>(
  network: NetworkId,
  accountId: string,
  methodName: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const argsBase64 = Buffer.from(JSON.stringify(args)).toString("base64");
  const result = await rpcCall<{ result: number[] }>(network, "query", {
    request_type: "call_function",
    finality: "final",
    account_id: accountId,
    method_name: methodName,
    args_base64: argsBase64,
  });

  const decoded = Buffer.from(result.result).toString("utf8");
  return JSON.parse(decoded) as T;
}

export type StorageBalance = {
  total: string;
  available: string;
};

export async function storageBalanceOf(
  network: NetworkId,
  tokenContractId: string,
  accountId: string,
): Promise<StorageBalance | null> {
  return viewFunction<StorageBalance | null>(
    network,
    tokenContractId,
    "storage_balance_of",
    { account_id: accountId },
  );
}
