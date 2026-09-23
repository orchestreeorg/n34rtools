"use client";

import { NearProvider } from "near-connect-hooks";
import { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <NearProvider
      config={{
        network: "testnet",
        providers: {
          mainnet: ["https://free.rpc.fastnear.com"],
          testnet: ["https://test.rpc.fastnear.com"],
        },
      }}
    >
      {children}
    </NearProvider>
  );
}
