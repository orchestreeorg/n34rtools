import type { AccountKind } from "./types";

const NEAR_ACCOUNT_REGEX =
  /^(([a-z\d]+[\-_])*[a-z\d]+\.)*([a-z\d]+[\-_])*[a-z\d]+$/;

const EMPTY_CODE_HASH = "11111111111111111111111111111111";

export function isValidAccountIdFormat(accountId: string): boolean {
  if (typeof accountId !== "string") return false;
  if (accountId.length < 2 || accountId.length > 64) return false;
  return NEAR_ACCOUNT_REGEX.test(accountId);
}

function isLowerHex(value: string, length: number): boolean {
  return value.length === length && /^[0-9a-f]+$/.test(value);
}

export function classifyAccountId(accountId: string): AccountKind {
  if (accountId.startsWith("0x") && isLowerHex(accountId.slice(2), 40)) {
    return "ethereum";
  }
  if (accountId.startsWith("0s") && isLowerHex(accountId.slice(2), 40)) {
    return "deterministic";
  }
  if (isLowerHex(accountId, 64)) {
    return "implicit";
  }
  if (accountId.endsWith(".near") || accountId.endsWith(".testnet")) {
    return "named-tla";
  }
  return "named";
}

export function kindLabel(kind: AccountKind): string {
  switch (kind) {
    case "ethereum":
      return "Ethereum-style (0x)";
    case "deterministic":
      return "Deterministic (0s)";
    case "implicit":
      return "Implicit hex account";
    case "named-tla":
      return "Named account";
    case "named":
      return "Named account";
  }
}

export function isEmptyCodeHash(codeHash: string | null | undefined): boolean {
  return !codeHash || codeHash === EMPTY_CODE_HASH;
}
