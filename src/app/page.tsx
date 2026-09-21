import { SendGuard } from "@/components/send-guard";
import { SiteHeader } from "@/components/site-header";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <SendGuard />
      </main>
      <footer className="border-t border-line px-5 py-6 text-center font-mono text-xs text-muted sm:px-8">
        n34r.tools · public FastNear RPC · no keys stored
      </footer>
    </>
  );
}
