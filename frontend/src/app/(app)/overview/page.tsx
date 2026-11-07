import type { Metadata } from "next";
import { OverviewPage } from "@/components/pages/overview";

// Signed-in pages load their data on the client, so they are not instant by design.
export const instant = false;

export const metadata: Metadata = { title: "Overview" };

export default function Page() {
  return <OverviewPage />;
}
