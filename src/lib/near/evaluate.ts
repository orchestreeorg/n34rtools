import { classifyAccountId, isValidAccountIdFormat } from "./account";
import type { AccountKind, InspectReason, InspectStatus } from "./types";

export type EvaluateInput = {
  accountId: string;
  exists: boolean;
  tokenRegistered?: boolean | null;
};

export type EvaluateResult = {
  formatValid: boolean;
  kind: AccountKind | null;
  status: InspectStatus;
  reason: InspectReason;
  title: string;
  detail: string;
};

export function evaluateRecipient({
  accountId,
  exists,
  tokenRegistered = null,
}: EvaluateInput): EvaluateResult {
  if (!isValidAccountIdFormat(accountId)) {
    return {
      formatValid: false,
      kind: null,
      status: "block",
      reason: "invalid-format",
      title: "Invalid account ID",
      detail:
        "NEAR account IDs are 2–64 characters, lowercase a–z, digits, and separators . - _ with no leading, trailing, or doubled separators.",
    };
  }

  const kind = classifyAccountId(accountId);

  if (!exists && kind === "deterministic") {
    return {
      formatValid: true,
      kind,
      status: "block",
      reason: "deterministic-not-a-target",
      title: "Do not send here",
      detail:
        "Deterministic 0s accounts are not transfer targets unless you already know this exact address is in use.",
    };
  }

  if (!exists && (kind === "named" || kind === "named-tla")) {
    return {
      formatValid: true,
      kind,
      status: "block",
      reason: "account-does-not-exist",
      title: "Account does not exist",
      detail:
        "A transfer to a missing named account fails and is refunded. Double-check the spelling before retrying.",
    };
  }

  if (!exists) {
    return {
      formatValid: true,
      kind,
      status: "confirm",
      reason: "unfunded-account",
      title: "Account is not funded yet",
      detail:
        "Funds sent here are only recoverable by whoever holds the matching private key. Require an extra confirmation, or send a tiny test amount first.",
    };
  }

  if (tokenRegistered === false) {
    return {
      formatValid: true,
      kind,
      status: "confirm",
      reason: "needs-storage-deposit",
      title: "Recipient is not registered for this token",
      detail:
        "The FT transfer will fail unless you batch a storage_deposit for this account first.",
    };
  }

  return {
    formatValid: true,
    kind,
    status: "ok",
    reason: "ok",
    title: "Looks safe to send",
    detail:
      "This account exists on-chain. Still show the full ID in your confirmation step — look-alike characters hide in the middle of long addresses.",
  };
}
