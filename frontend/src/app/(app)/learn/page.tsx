import type { Metadata } from "next";
import { LearnPage } from "@/components/pages/learn";

// Signed-in pages load their data on the client, so they are not instant by design.
export const instant = false;

export const metadata: Metadata = { title: "Learn" };

export default function Page() {
  return <LearnPage />;
}
