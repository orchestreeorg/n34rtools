import {
  classifyAccountId,
  isEmptyCodeHash,
  isValidAccountIdFormat,
} from "@/lib/near/account";
import { evaluateRecipient } from "@/lib/near/evaluate";
import type { AccessKeySummary, InspectReport, NetworkId } from "@/lib/near/types";
import {
  availableBalanceYocto,
  parseYoctoFromProtocol,
  yoctoToNear,
} from "@/lib/near/units";
import {
  storageBalanceOf,
  viewAccessKeyList,
  viewAccount,
  viewProtocolConfig,
  type NearAccessKey,
} from "@/lib/rpc/near";

export type InspectRequest = {
  accountId: string;
  network: NetworkId;
  tokenContractId?: string;
};

function summarizeKeys(keys: NearAccessKey[]): AccessKeySummary {
  let fullAccess = 0;
  let functionCall = 0;
  for (const key of keys) {
    if (key.access_key.permission === "FullAccess") {
      fullAccess += 1;
    } else {
      functionCall += 1;
    }
  }
  return { total: keys.length, fullAccess, functionCall };
}

export async function inspectRecipient({
  accountId,
  network,
  tokenContractId,
}: InspectRequest): Promise<InspectReport> {
  const trimmed = accountId.trim();
  const tokenId = tokenContractId?.trim() || undefined;

  if (!isValidAccountIdFormat(trimmed)) {
    const decision = evaluateRecipient({ accountId: trimmed, exists: false });
    return {
      accountId: trimmed,
      network,
      formatValid: false,
      kind: null,
      exists: false,
      isContract: false,
      status: decision.status,
      reason: decision.reason,
      title: decision.title,
      detail: decision.detail,
      balance: null,
      storageUsageBytes: null,
      codeHash: null,
      keys: null,
      token: null,
    };
  }

  const invalidToken = Boolean(tokenId && !isValidAccountIdFormat(tokenId));

  const [account, protocol] = await Promise.all([
    viewAccount(network, trimmed),
    viewProtocolConfig(network),
  ]);

  const exists = account !== null;
  const costPerByte = parseYoctoFromProtocol(
    protocol?.runtime_config?.storage_amount_per_byte,
  );

  let keys: AccessKeySummary | null = null;
  if (exists) {
    try {
      keys = summarizeKeys(await viewAccessKeyList(network, trimmed));
    } catch {
      keys = null;
    }
  }

  let token: InspectReport["token"] = null;
  let tokenRegistered: boolean | null = null;
  if (tokenId && invalidToken) {
    token = {
      contractId: tokenId,
      registered: false,
      depositNeededYocto: null,
      error: "invalid-token-id",
    };
  } else if (tokenId) {
    try {
      const balance = await storageBalanceOf(network, tokenId, trimmed);
      tokenRegistered = balance !== null;
      token = {
        contractId: tokenId,
        registered: tokenRegistered,
        depositNeededYocto: null,
      };
    } catch (error) {
      token = {
        contractId: tokenId,
        registered: false,
        depositNeededYocto: null,
        error: error instanceof Error ? error.message : "token-lookup-failed",
      };
    }
  }

  const decision =
    token?.error === "invalid-token-id"
      ? {
          formatValid: true,
          kind: classifyAccountId(trimmed),
          status: "block" as const,
          reason: "unsupported-token" as const,
          title: "Invalid token contract",
          detail: "The FT contract ID is not a valid NEAR account.",
        }
      : evaluateRecipient({
          accountId: trimmed,
          exists,
          tokenRegistered,
        });

  const storageUsageBytes = account?.storage_usage ?? null;
  const isContract = !isEmptyCodeHash(account?.code_hash);

  return {
    accountId: trimmed,
    network,
    formatValid: true,
    kind: decision.kind,
    exists,
    isContract,
    status: decision.status,
    reason: decision.reason,
    title: decision.title,
    detail: decision.detail,
    balance: account
      ? {
          totalYocto: (BigInt(account.amount) + BigInt(account.locked)).toString(),
          availableYocto: availableBalanceYocto(
            account.amount,
            account.locked,
            account.storage_usage,
            costPerByte,
          ).toString(),
          lockedYocto: account.locked,
          storageYocto: (
            BigInt(account.storage_usage) * costPerByte
          ).toString(),
          totalNear: yoctoToNear(BigInt(account.amount) + BigInt(account.locked)),
          availableNear: yoctoToNear(
            availableBalanceYocto(
              account.amount,
              account.locked,
              account.storage_usage,
              costPerByte,
            ),
          ),
          lockedNear: yoctoToNear(account.locked),
          storageNear: yoctoToNear(BigInt(account.storage_usage) * costPerByte),
        }
      : null,
    storageUsageBytes,
    codeHash: account?.code_hash ?? null,
    keys,
    token,
  };
}
