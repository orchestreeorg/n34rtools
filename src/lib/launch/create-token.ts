import { isValidAccountIdFormat } from "@/lib/near/account";
import { viewAccount } from "@/lib/rpc/near";
import {
  CONTRACTS,
  LAUNCH_NETWORK,
  SYMBOL_REGEX,
  predictedTokenId,
  tokenIcon,
  humanToTokenUnits,
} from "./contracts";
import { MAX_ICON_CHARS, isTokenIconDataUrl } from "./icon";

export type CreateTokenInput = {
  ownerId: string;
  name: string;
  symbol: string;
  supply: string;
  icon?: string;
};

export type CreateTokenPlan = {
  tokenId: string;
  factory: string;
  args: {
    args: {
      owner_id: string;
      total_supply: string;
      metadata: {
        spec: string;
        name: string;
        symbol: string;
        icon: string;
        decimals: number;
      };
    };
    account_id: string;
  };
  deposit: string;
  gas: string;
};

export async function preflightSymbol(symbol: string): Promise<{
  ok: boolean;
  tokenId: string;
  reason?: string;
}> {
  const normalized = symbol.trim().toLowerCase();
  const tokenId = predictedTokenId(normalized);

  if (!SYMBOL_REGEX.test(normalized)) {
    return {
      ok: false,
      tokenId,
      reason: "Use 2–12 chars, start with a letter, lowercase a–z and digits only.",
    };
  }

  if (!isValidAccountIdFormat(tokenId)) {
    return { ok: false, tokenId, reason: "That symbol would not make a valid NEAR account." };
  }

  const existing = await viewAccount(LAUNCH_NETWORK, tokenId);
  if (existing) {
    return { ok: false, tokenId, reason: "That symbol is already taken on the factory." };
  }

  return { ok: true, tokenId };
}

export function buildCreateTokenPlan(input: CreateTokenInput): CreateTokenPlan {
  const contracts = CONTRACTS[LAUNCH_NETWORK];
  if (!contracts.factory) {
    throw new Error("Token factory is not available on this network.");
  }

  const symbol = input.symbol.trim().toLowerCase();
  const name = input.name.trim();
  const totalSupply = humanToTokenUnits(input.supply, 18);
  const tokenId = predictedTokenId(symbol);

  if (!name) throw new Error("Name is required.");
  if (!SYMBOL_REGEX.test(symbol)) throw new Error("Invalid symbol.");
  if (BigInt(totalSupply) <= 0n) throw new Error("Supply must be greater than 0.");

  const icon = input.icon?.trim() || tokenIcon(symbol);
  if (!isTokenIconDataUrl(icon)) {
    throw new Error("Icon must be an on-chain image data URL.");
  }
  if (icon.length > MAX_ICON_CHARS) {
    throw new Error("Icon is too large for the factory deposit. Use a smaller image.");
  }

  return {
    tokenId,
    factory: contracts.factory,
    args: {
      args: {
        owner_id: input.ownerId,
        total_supply: totalSupply,
        metadata: {
          spec: "ft-1.0.0",
          name,
          symbol,
          icon,
          decimals: 18,
        },
      },
      account_id: input.ownerId,
    },
    deposit: contracts.factoryDepositYocto,
    gas: "300000000000000",
  };
}
