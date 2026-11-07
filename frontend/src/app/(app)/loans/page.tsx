import type { Metadata } from "next";
import { LoansPage } from "@/components/pages/loans";

// Signed-in pages load their data on the client, so they are not instant by design.
export const instant = false;

export const metadata: Metadata = { title: "Lend & borrow" };

export default function Page() {
  return <LoansPage />;
}
