import { getPoolView } from "@/lib/launch/pool";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenId = url.searchParams.get("tokenId") ?? "";
  const poolIdRaw = url.searchParams.get("poolId");
  const poolId = poolIdRaw ? Number(poolIdRaw) : undefined;

  if (!tokenId.trim() && (poolId === undefined || !Number.isFinite(poolId))) {
    return NextResponse.json({ error: "tokenId or poolId is required" }, { status: 400 });
  }

  try {
    const pool = await getPoolView(tokenId || undefined, poolId);
    if (!pool) {
      return NextResponse.json({ error: "No TOKEN / wNEAR pool found." }, { status: 404 });
    }
    return NextResponse.json(pool);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pool lookup failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
