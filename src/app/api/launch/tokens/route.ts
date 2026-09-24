import { listLaunchedTokens } from "@/lib/launch/list-tokens";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const accountId = new URL(request.url).searchParams.get("accountId") ?? "";
  if (!accountId.trim()) {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }

  try {
    const tokens = await listLaunchedTokens(accountId);
    return NextResponse.json({ accountId: accountId.trim().toLowerCase(), tokens });
  } catch (error) {
    const message = error instanceof Error ? error.message : "List failed";
    const status = message === "Invalid account id." ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
