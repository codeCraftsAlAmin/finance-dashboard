import type { Metadata } from "next";
import { BillsPage } from "@/components/pages/bills";

// Signed-in pages load their data on the client, so they are not instant by design.
export const instant = false;

export const metadata: Metadata = { title: "Monthly" };

export default function Page() {
  return <BillsPage />;
}
