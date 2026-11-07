import type { Metadata } from "next";
import { DatesPage } from "@/components/pages/dates";

// Signed-in pages load their data on the client, so they are not instant by design.
export const instant = false;

export const metadata: Metadata = { title: "Dates" };

export default function Page() {
  return <DatesPage />;
}
