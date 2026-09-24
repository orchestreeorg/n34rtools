import { quoteSwap } from "@/lib/launch/pool";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenId = url.searchParams.get("tokenId") ?? "";
  const amount = url.searchParams.get("amount") ?? "";
  const side = url.searchParams.get("side") ?? "buy";
  const poolIdRaw = url.searchParams.get("poolId");
  const poolId = poolIdRaw ? Number(poolIdRaw) : undefined;

  if (!tokenId.trim() || !amount.trim()) {
    return NextResponse.json({ error: "tokenId and amount are required" }, { status: 400 });
  }

  try {
    const quote = await quoteSwap({
      tokenId,
      poolId: poolId !== undefined && Number.isFinite(poolId) ? poolId : undefined,
      amount,
      sellingNear: side !== "sell",
    });
    return NextResponse.json(quote);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Quote failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
