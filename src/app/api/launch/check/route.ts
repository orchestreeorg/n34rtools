import { preflightSymbol } from "@/lib/launch/create-token";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let body: { symbol?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const symbol = typeof body.symbol === "string" ? body.symbol : "";
  if (!symbol.trim()) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  try {
    const result = await preflightSymbol(symbol);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Check failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
