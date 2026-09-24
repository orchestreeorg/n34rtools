"use client";

import { N34rLogo } from "@/components/n34r-logo";
import { useNearWallet } from "near-connect-hooks";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

function shortAccount(id: string): string {
  if (id.length <= 22) return id;
  return `${id.slice(0, 10)}…${id.slice(-8)}`;
}

export function SiteHeader() {
  const pathname = usePathname();
  const { loading, signedAccountId, signIn, signOut } = useNearWallet();

  return (
    <header className="border-b border-line bg-background">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
        <div className="flex items-center gap-6">
          <Link href="/" className="inline-flex items-center" aria-label="n34r.tools home">
            <N34rLogo />
          </Link>
          <nav className="hidden items-center gap-4 sm:flex">
            <NavLink href="/" active={pathname === "/"}>
              Send Guard
            </NavLink>
            <NavLink href="/launch" active={pathname === "/launch"}>
              Launch
            </NavLink>
            <NavLink href="/swap" active={pathname === "/swap"}>
              Swap
            </NavLink>
          </nav>
          <nav className="flex items-center gap-3 sm:hidden">
            <NavLink href="/" active={pathname === "/"}>
              Guard
            </NavLink>
            <NavLink href="/launch" active={pathname === "/launch"}>
              Launch
            </NavLink>
            <NavLink href="/swap" active={pathname === "/swap"}>
              Swap
            </NavLink>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {loading ? (
            <span className="font-mono text-[11px] text-muted">Wallet…</span>
          ) : signedAccountId ? (
            <>
              <span className="hidden font-mono text-[11px] text-muted sm:inline">
                {shortAccount(signedAccountId)}
              </span>
              <button
                type="button"
                onClick={() => void signOut()}
                className="rounded-lg border border-line px-3 py-1.5 font-mono text-[11px] text-muted uppercase hover:text-white"
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void signIn()}
              className="rounded-lg bg-ok px-3 py-1.5 font-mono text-[11px] font-semibold text-background uppercase"
            >
              Connect
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`font-mono text-[11px] tracking-[0.18em] uppercase ${
        active ? "text-ok" : "text-muted hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}
