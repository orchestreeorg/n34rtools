import { inspectRecipient } from "@/lib/inspect";
import type { NetworkId } from "@/lib/near/types";
import { NextResponse } from "next/server";

const NETWORKS = new Set<NetworkId>(["mainnet", "testnet"]);

export async function POST(request: Request) {
  let body: {
    accountId?: unknown;
    network?: unknown;
    tokenContractId?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const accountId = typeof body.accountId === "string" ? body.accountId : "";
  const network = body.network;
  const tokenContractId =
    typeof body.tokenContractId === "string" ? body.tokenContractId : undefined;

  if (!accountId.trim()) {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }

  if (typeof network !== "string" || !NETWORKS.has(network as NetworkId)) {
    return NextResponse.json(
      { error: "network must be mainnet or testnet" },
      { status: 400 },
    );
  }

  try {
    const report = await inspectRecipient({
      accountId,
      network: network as NetworkId,
      tokenContractId,
    });
    return NextResponse.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Inspect failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
