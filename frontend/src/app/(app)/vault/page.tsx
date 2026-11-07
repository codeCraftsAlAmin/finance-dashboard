import type { Metadata } from "next";
import { VaultPage } from "@/components/pages/vault";

// Signed-in pages load their data on the client, so they are not instant by design.
export const instant = false;

export const metadata: Metadata = { title: "Vault" };

export default function Page() {
  return <VaultPage />;
}
