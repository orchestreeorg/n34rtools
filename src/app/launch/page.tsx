import { LaunchPad } from "@/components/launch-pad";
import { SiteHeader } from "@/components/site-header";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Launch",
  description: "Create a fun NEP-141 token on NEAR testnet.",
};

export default function LaunchPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <LaunchPad />
      </main>
      <footer className="border-t border-line px-5 py-6 text-center font-mono text-xs text-muted sm:px-8">
        n34r.tools · testnet factory · you sign, we never hold keys
      </footer>
    </>
  );
}
