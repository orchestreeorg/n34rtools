const YOCTO_PER_NEAR = 1_000_000_000_000_000_000_000_000n;
const DEFAULT_STORAGE_PER_BYTE = 10_000_000_000_000_000_000n;

export function yoctoToNear(yocto: string | bigint, digits = 5): string {
  const value = typeof yocto === "bigint" ? yocto : BigInt(yocto || "0");
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = abs / YOCTO_PER_NEAR;
  const frac = abs % YOCTO_PER_NEAR;
  const fracStr = frac.toString().padStart(24, "0").slice(0, digits).replace(/0+$/, "");
  const formatted = fracStr.length > 0 ? `${whole}.${fracStr}` : whole.toString();
  return negative ? `-${formatted}` : formatted;
}

export function storageStakeYocto(
  storageUsageBytes: number,
  costPerByte = DEFAULT_STORAGE_PER_BYTE,
): bigint {
  return BigInt(storageUsageBytes) * costPerByte;
}

export function availableBalanceYocto(
  amountYocto: string,
  lockedYocto: string,
  storageUsageBytes: number,
  costPerByte = DEFAULT_STORAGE_PER_BYTE,
): bigint {
  const amount = BigInt(amountYocto || "0");
  const locked = BigInt(lockedYocto || "0");
  const usedOnStorage = storageStakeYocto(storageUsageBytes, costPerByte);
  const total = amount + locked;
  const reserved = locked > usedOnStorage ? locked : usedOnStorage;
  return total > reserved ? total - reserved : 0n;
}

export function parseYoctoFromProtocol(value: string | number | undefined): bigint {
  if (value === undefined || value === null) return DEFAULT_STORAGE_PER_BYTE;
  return BigInt(value);
}
