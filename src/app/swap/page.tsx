import { SiteHeader } from "@/components/site-header";
import { SwapPad } from "@/components/swap-pad";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Swap",
  description: "See the testnet TOKEN / wNEAR price and swap on Ref Finance.",
};

export default function SwapPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Suspense fallback={<p className="px-5 py-10 text-muted">Loading swap…</p>}>
          <SwapPad />
        </Suspense>
      </main>
      <footer className="border-t border-line px-5 py-6 text-center font-mono text-xs text-muted sm:px-8">
        n34r.tools · Ref testnet swap · you sign, we never hold keys
      </footer>
    </>
  );
}
