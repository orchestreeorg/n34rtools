import { N34rLogo } from "@/components/n34r-logo";

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-background">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-3.5 sm:px-8">
        <a href="/" className="inline-flex items-center" aria-label="n34r.tools home">
          <N34rLogo />
        </a>
        <p className="font-mono text-[11px] tracking-[0.18em] text-muted uppercase">
          Send Guard
        </p>
      </div>
    </header>
  );
}
