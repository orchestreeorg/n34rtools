export type NetworkId = "mainnet" | "testnet";

export type AccountKind =
  | "ethereum"
  | "deterministic"
  | "implicit"
  | "named-tla"
  | "named";

export type InspectStatus = "ok" | "confirm" | "block";

export type InspectReason =
  | "ok"
  | "invalid-format"
  | "account-does-not-exist"
  | "unfunded-account"
  | "deterministic-not-a-target"
  | "needs-storage-deposit"
  | "unsupported-token";

export type AccessKeyPermission = "full-access" | "function-call";

export type AccessKeySummary = {
  total: number;
  fullAccess: number;
  functionCall: number;
};

export type TokenRegistration = {
  contractId: string;
  registered: boolean;
  depositNeededYocto: string | null;
  error?: string;
};

export type InspectReport = {
  accountId: string;
  network: NetworkId;
  formatValid: boolean;
  kind: AccountKind | null;
  exists: boolean;
  isContract: boolean;
  status: InspectStatus;
  reason: InspectReason;
  title: string;
  detail: string;
  balance: {
    totalYocto: string;
    availableYocto: string;
    lockedYocto: string;
    storageYocto: string;
    totalNear: string;
    availableNear: string;
    lockedNear: string;
    storageNear: string;
  } | null;
  storageUsageBytes: number | null;
  codeHash: string | null;
  keys: AccessKeySummary | null;
  token: TokenRegistration | null;
};
