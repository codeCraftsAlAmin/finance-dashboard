import type { Metadata } from "next";
import { MoneyPage } from "@/components/pages/money";

// Signed-in pages load their data on the client, so they are not instant by design.
export const instant = false;

export const metadata: Metadata = { title: "Money" };

export default function Page() {
  return <MoneyPage />;
}
